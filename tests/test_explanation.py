import json
from fastapi.testclient import TestClient
from backend.main import app
from unittest.mock import patch, MagicMock
import os

client = TestClient(app)

dummy_evidence = {
    "evidence_result": {
        "overall_risk_score": 85.0,
        "risk_level": "HIGH",
        "evidence_strength": "HIGH",
        "confidence": "HIGH",
        "evidence_items": [
            {
                "evidence_id": "123",
                "category": "Source similarity",
                "signal_name": "Direct Semantic Match",
                "score": 90.0,
                "severity": "HIGH",
                "description": "High match.",
                "supporting_metrics": {},
                "reliability": "HIGH",
                "contribution_to_risk": 40.0
            }
        ],
        "safeguard_warnings": [],
        "conclusion": "High investigation risk."
    }
}

class DummyInteraction:
    def __init__(self, output_text):
        self.output_text = output_text

@patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"})
@patch("ml.explanation.service.genai.Client")
def test_explanation_success(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response_json = json.dumps({
        "executive_summary": "The submission shows several signals associated with high risk.",
        "main_evidence_findings": ["Source similarity is very high."],
        "why_each_finding_matters": ["Direct matches indicate unoriginal content."],
        "conflicting_weak_evidence": [],
        "limitations": ["Automated analysis is not definitive."],
        "recommended_instructor_action": "Instructor review is recommended."
    })
    
    mock_client.interactions.create.return_value = DummyInteraction(output_text=mock_response_json)
    
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Instructor review" in data["report"]["recommended_instructor_action"]

@patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"})
@patch("ml.explanation.service.genai.Client")
def test_explanation_api_failure(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.interactions.create.side_effect = Exception("API timeout")
    
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "API timeout" in data["error"]
    # Fallback report should be returned
    assert "automated analysis" in data["report"]["executive_summary"].lower()

@patch.dict(os.environ, {}, clear=True)
def test_explanation_missing_api_key():
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "GEMINI_API_KEY" in data["error"]

@patch.dict(os.environ, {"LLM_PROVIDER": "groq", "GROQ_API_KEY": "fake_groq_key"})
@patch("groq.Groq")
def test_explanation_groq_success(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_response_json = json.dumps({
        "executive_summary": "Groq: The submission shows several signals associated with high risk.",
        "main_evidence_findings": ["Source similarity is very high."],
        "why_each_finding_matters": ["Direct matches indicate unoriginal content."],
        "conflicting_weak_evidence": [],
        "limitations": ["Automated analysis is not definitive."],
        "recommended_instructor_action": "Instructor review is recommended."
    })
    
    # Mock chat.completions.create
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = mock_response_json
    mock_completion.choices = [mock_choice]
    mock_client.chat.completions.create.return_value = mock_completion
    
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Groq:" in data["report"]["executive_summary"]

@patch.dict(os.environ, {"LLM_PROVIDER": "groq", "GROQ_API_KEY": ""}, clear=True)
def test_explanation_groq_missing_key():
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "GROQ_API_KEY is not set" in data["error"]

@patch.dict(os.environ, {"LLM_PROVIDER": "groq", "GROQ_API_KEY": "fake_groq_key"})
@patch("groq.Groq")
def test_explanation_groq_api_failure(mock_groq_class):
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    mock_client.chat.completions.create.side_effect = Exception("Groq timeout")
    
    response = client.post("/api/analysis/explanation", json=dummy_evidence)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Groq timeout" in data["error"]
