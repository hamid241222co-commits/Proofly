import datetime
import traceback
import time
import logging
import concurrent.futures
from typing import List, Dict, Any, Optional
from ml.orchestrator.models import OrchestratorResult

# Import all core services
from backend.services.extraction import extract_text
from ml.features.extractor import extract_features
from ml.ai_detection.engine import analyze_signals
from ml.fingerprint.service import compare_fingerprints
from ml.source_analysis.service import calculate_similarity
from ml.source_analysis.models import ReferenceDocument
from ml.paraphrase.service import calculate_paraphrase
from ml.evidence_engine.service import calculate_evidence
from ml.evidence_engine.models import EvidenceEngineRequest
from ml.explanation.service import generate_explanation

# Database Repository
from backend.db.repository import DatabaseRepository

logger = logging.getLogger(__name__)

def run_orchestrator(
    student_id: str,
    assignment_name: str,
    filename: str,
    file_type: str,
    file_bytes: bytes,
    reference_sources: Optional[List[Dict[str, str]]] = None
) -> OrchestratorResult:
    
    overall_start_time = time.time()
    errors: List[str] = []
    repo = DatabaseRepository()
    
    # 1. Start submission tracking
    db_start = time.time()
    submission_id = "temp_" + str(datetime.datetime.now().timestamp())
    try:
        db_sub = repo.save_submission(student_id, assignment_name)
        if db_sub and "id" in db_sub:
            submission_id = db_sub["id"]
    except Exception as e:
        errors.append(f"DB submission failed: {str(e)}")
    db_dur = time.time() - db_start
    logger.info(f"DB init duration: {db_dur:.2f}s")

    # 2. Text Extraction
    ext_start = time.time()
    try:
        extracted_text = extract_text(file_bytes, filename, file_type)
        if not extracted_text:
            return _bail_out(submission_id, student_id, assignment_name, "No readable text found in document.")
            
        char_count = len(extracted_text)
        word_count = len(extracted_text.split())
        
        try:
            repo.save_document(submission_id, filename, file_type, char_count, word_count, extracted_text)
        except Exception as e:
            errors.append(f"DB document failed: {str(e)}")
            
    except Exception as e:
        return _bail_out(submission_id, student_id, assignment_name, f"Text extraction failed: {str(e)}")
    
    ext_dur = time.time() - ext_start
    logger.info(f"Extraction duration: {ext_dur:.2f}s")

    if word_count < 10:
        return _bail_out(submission_id, student_id, assignment_name, "Document is too short for any meaningful analysis.")

    # Prevent massive files from exhausting API limits
    if word_count > 25000:
        # Truncate text to approx 25k words (taking the first 25k)
        extracted_text = " ".join(extracted_text.split()[:25000])
        errors.append("Document exceeded 25,000 words. Analysis was truncated to the first 25,000 words.")

    # PARALLEL EXECUTION OF FEATURES
    ai_start = time.time()
    features, ai_signals, fingerprint, source_similarity, paraphrase = None, None, None, None, None
    
    # 1. Run core feature extraction first (synchronously) to avoid redundant heavy NLP processing
    try:
        features = extract_features(extracted_text)
    except Exception as e:
        errors.append(f"Feature extraction failed: {str(e)}")
        # We need features for the other models, so we bail out if this fails completely.
        from ml.features.extractor import get_empty_features
        features = get_empty_features()

    def run_source_sim():
        if not reference_sources: return None, None
        refs = [ReferenceDocument(id=r["id"], text=r["text"]) for r in reference_sources]
        ss = calculate_similarity(extracted_text, refs)
        pa = None
        if ss and ss.top_matches:
            top_match_id = ss.top_matches[0].reference_id
            matched_ref_text = next((r.text for r in refs if r.id == top_match_id), None)
            if matched_ref_text:
                pa = calculate_paraphrase(matched_ref_text, extracted_text, sub_features=features)
        return ss, pa
        
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    f_sig = executor.submit(analyze_signals, extracted_text, features)
    f_fin = executor.submit(compare_fingerprints, None, extracted_text, features)
    f_src = executor.submit(run_source_sim)
    
    try:
        ai_signals = f_sig.result(timeout=30)
    except Exception as e:
        errors.append(f"AI signals failed or timed out: {str(e)}")
        
    try:
        fingerprint = f_fin.result(timeout=30)
        if fingerprint and fingerprint.error:
            errors.append(f"Fingerprint info: {fingerprint.error}")
    except Exception as e:
        errors.append(f"Fingerprint comparison failed or timed out: {str(e)}")
        
    try:
        src_res = f_src.result(timeout=60)
        if src_res:
            source_similarity, paraphrase = src_res
            if paraphrase and paraphrase.error:
                errors.append(f"Paraphrase info: {paraphrase.error}")
    except Exception as e:
        errors.append(f"Source similarity/paraphrase failed or timed out: {str(e)}")

    executor.shutdown(wait=False, cancel_futures=True)

    ai_dur = time.time() - ai_start
    logger.info(f"AI analysis duration (Parallel): {ai_dur:.2f}s")

    # 8. Save Analysis Results to DB
    try:
        repo.save_analysis_results(
            submission_id,
            linguistic=features.model_dump() if features else None,
            ai_signals=ai_signals.model_dump() if ai_signals else None,
            source_similarity=source_similarity.model_dump() if source_similarity else None,
            paraphrase=paraphrase.model_dump() if paraphrase else None,
            fingerprint=fingerprint.model_dump() if fingerprint else None
        )
    except Exception as e:
         errors.append(f"DB analysis results failed: {str(e)}")

    # 9. Evidence Engine
    evidence_engine_result = None
    try:
        req = EvidenceEngineRequest(
            word_count=word_count,
            ai_signals=ai_signals,
            fingerprint_comparison=fingerprint,
            source_similarity=source_similarity,
            paraphrase_analysis=paraphrase
        )
        evidence_engine_result = calculate_evidence(req)
        
        try:
            repo.save_evidence(submission_id, [item.model_dump() for item in evidence_engine_result.evidence_items])
        except Exception as e:
            errors.append(f"DB evidence failed: {str(e)}")
            
    except Exception as e:
        errors.append(f"Evidence engine failed: {str(e)}")
        # We need a fallback evidence result if it completely crashed
        from ml.evidence_engine.models import EvidenceEngineResult
        evidence_engine_result = EvidenceEngineResult(
            overall_risk_score=0.0,
            risk_level="LOW",
            evidence_strength="LOW",
            confidence="LOW",
            evidence_items=[],
            safeguard_warnings=["Evidence engine completely failed."],
            conclusion="Analysis failed."
        )

    # 10. Gemini Explanation
    exp_start = time.time()
    explanation = None
    try:
        exp_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        exp_future = exp_executor.submit(generate_explanation, evidence_engine_result)
        explanation_res = exp_future.result(timeout=45)
        exp_executor.shutdown(wait=False, cancel_futures=True)
            
        explanation = explanation_res.report
        if not explanation_res.success:
            errors.append(f"Explanation info: {explanation_res.error}")
    except concurrent.futures.TimeoutError:
        exp_executor.shutdown(wait=False, cancel_futures=True)
        errors.append("Explanation failed: Timed out after 45 seconds.")
    except Exception as e:
        exp_executor.shutdown(wait=False, cancel_futures=True)
        errors.append(f"Explanation failed: {str(e)}")
        
    exp_dur = time.time() - exp_start
    logger.info(f"Explanation duration: {exp_dur:.2f}s")

    # 11. Persist Report
    try:
        repo.save_report(
            submission_id,
            evidence_engine_result.overall_risk_score,
            evidence_engine_result.risk_level,
            evidence_engine_result.evidence_strength,
            evidence_engine_result.confidence,
            evidence_engine_result.safeguard_warnings,
            evidence_engine_result.conclusion,
            explanation.model_dump() if explanation else None
        )
    except Exception as e:
         errors.append(f"DB report failed: {str(e)}")

    logger.info(f"Total pipeline duration: {time.time() - overall_start_time:.2f}s")

    return OrchestratorResult(
        submission_id=submission_id,
        student_id=student_id,
        assignment_name=assignment_name,
        document_statistics={"character_count": char_count, "word_count": word_count},
        linguistic_features=features,
        ai_linguistic_signals=ai_signals,
        writing_fingerprint_comparison=fingerprint,
        source_similarity=source_similarity,
        paraphrase_analysis=paraphrase,
        evidence_list=evidence_engine_result.evidence_items,
        risk_score=evidence_engine_result.overall_risk_score,
        risk_level=evidence_engine_result.risk_level,
        confidence=evidence_engine_result.confidence,
        safeguard_warnings=evidence_engine_result.safeguard_warnings,
        gemini_explanation=explanation,
        analysis_timestamp=datetime.datetime.now().isoformat(),
        errors=errors
    )

def _bail_out(submission_id: str, student_id: str, assignment_name: str, error_msg: str) -> OrchestratorResult:
    # Partial failure where we can't even extract text
    return OrchestratorResult(
        submission_id=submission_id,
        student_id=student_id,
        assignment_name=assignment_name,
        document_statistics={},
        linguistic_features=None,
        ai_linguistic_signals=None,
        writing_fingerprint_comparison=None,
        source_similarity=None,
        paraphrase_analysis=None,
        evidence_list=[],
        risk_score=0.0,
        risk_level="LOW",
        confidence="LOW",
        safeguard_warnings=[error_msg],
        gemini_explanation=None,
        analysis_timestamp=datetime.datetime.now().isoformat(),
        errors=[error_msg]
    )
