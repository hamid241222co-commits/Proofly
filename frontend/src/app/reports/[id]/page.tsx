'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

function ReportContent() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
    });
    
    // For this prototype, we retrieve the cached report from localStorage
    if (id) {
      const cachedReport = localStorage.getItem(`report_${id}`);
      if (cachedReport) {
        setReport(JSON.parse(cachedReport));
      }
    }
    setLoading(false);
  }, [id, router, supabase]);

  if (loading) return <div className="p-10 text-center">Loading report...</div>;
  if (!report) return <div className="p-10 text-center text-red-500">Report not found.</div>;

  const riskColor = report.risk_level === 'HIGH' ? 'text-red-600 bg-red-100' : 
                    report.risk_level === 'MEDIUM' ? 'text-yellow-600 bg-yellow-100' : 'text-green-600 bg-green-100';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analysis Report</h1>
          <p className="text-gray-500">ID: {report.submission_id}</p>
        </div>
        <div className={`px-4 py-2 rounded-full font-bold text-lg ${riskColor}`}>
          Risk Level: {report.risk_level || 'UNKNOWN'} ({typeof report.risk_score === 'number' ? report.risk_score.toFixed(2) + '%' : 'N/A'})
        </div>
      </div>

      {Array.isArray(report.errors) && report.errors.length > 0 && (
        <div className="mb-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <p className="font-bold">Analysis Warnings:</p>
          </div>
          <ul className="list-disc ml-10 mt-2">
            {report.errors.map((err: string, i: number) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Explanation Section */}
      {report.gemini_explanation && (
        <div className="bg-white shadow rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50 flex items-center">
            <Shield className="h-5 w-5 text-indigo-600 mr-2" />
            <h2 className="text-xl font-bold text-indigo-900">Executive Summary</h2>
          </div>
          <div className="p-6">
            <p className="text-gray-800 text-lg mb-4">{report.gemini_explanation.executive_summary || 'No summary available.'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 border-b pb-2">Key Findings</h3>
                <ul className="list-disc ml-5 space-y-1 text-gray-700">
                  {Array.isArray(report.gemini_explanation.main_evidence_findings) && report.gemini_explanation.main_evidence_findings.length > 0 
                    ? report.gemini_explanation.main_evidence_findings.map((f: string, i: number) => <li key={i}>{f}</li>)
                    : <li>No key findings available.</li>}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 border-b pb-2">Limitations & Context</h3>
                <ul className="list-disc ml-5 space-y-1 text-gray-700">
                  {Array.isArray(report.gemini_explanation.limitations) && report.gemini_explanation.limitations.length > 0
                    ? report.gemini_explanation.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)
                    : <li>No limitations specified.</li>}
                </ul>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-100">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                <p className="text-blue-800"><span className="font-semibold">Recommended Action:</span> {report.gemini_explanation.recommended_instructor_action || 'Review manually.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Signals */}
      {report.ai_linguistic_signals && (
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">AI-Writing Signals</h2>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border inline-block min-w-[200px]">
                <p className="text-sm text-gray-500 font-medium">Overall AI Signal Score</p>
                <p className="text-2xl font-bold text-gray-900">
                  {typeof report.ai_linguistic_signals.ai_linguistic_signal === 'number' 
                    ? report.ai_linguistic_signals.ai_linguistic_signal.toFixed(2) + '/100'
                    : 'Not available'}
                </p>
              </div>
            </div>
            
            <h3 className="font-semibold text-gray-800 mb-4">Detected Patterns</h3>
            {Array.isArray(report.ai_linguistic_signals.signals) && report.ai_linguistic_signals.signals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.ai_linguistic_signals.signals.map((s: any, i: number) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${typeof s.score === 'number' && s.score > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {typeof s.score === 'number' ? s.score.toFixed(1) : '?'} / 100
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{s.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No specific patterns available.</p>
            )}
          </div>
        </div>
      )}

      {/* Source Similarity */}
      {report.source_similarity && (
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Source Similarity</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center mb-4">
              <span className="font-medium mr-2">Maximum Similarity Score:</span>
              <span className="text-lg font-bold">
                {typeof report.source_similarity.max_similarity_score === 'number' 
                  ? (report.source_similarity.max_similarity_score * 100).toFixed(1) + '%' 
                  : 'Not available'}
              </span>
            </div>
            {Array.isArray(report.source_similarity.matches) && report.source_similarity.matches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Similarity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.source_similarity.matches.map((m: any, i: number) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{m?.source_id || 'Unknown'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {typeof m?.similarity_score === 'number' ? (m.similarity_score * 100).toFixed(1) + '%' : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No significant source similarities found.</p>
            )}
          </div>
        </div>
      )}
      
      {/* Evidence */}
      {Array.isArray(report.evidence_list) && report.evidence_list.length > 0 && (
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Detailed Evidence</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {report.evidence_list.map((item: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between">
                    <h3 className="font-bold text-gray-800 capitalize">{(item?.type || item?.category || 'Unknown').replace('_', ' ')} Evidence</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item?.severity === 'high' ? 'bg-red-100 text-red-800' : item?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                      {(item?.severity || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-700">{item?.description || 'No description available.'}</p>
                  {item?.evidence_text && (
                    <div className="mt-3 bg-gray-50 p-3 text-sm font-mono text-gray-600 rounded">
                      "{item.evidence_text}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>This report is generated using explainable ML heuristics and does not constitute definitive proof of academic misconduct.</p>
        <p>Human review is required.</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading report parameters...</div>}>
      <ReportContent />
    </Suspense>
  );
}
