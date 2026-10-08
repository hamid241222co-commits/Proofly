'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchApi } from '@/lib/api';

export default function NewSubmission() {
  const router = useRouter();
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [studentId, setStudentId] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login');
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setProgress('Uploading and analyzing document... This may take a minute.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('student_id', studentId);
    formData.append('assignment_name', assignmentName);
    // Optional: add reference_sources_json if implemented in UI

    try {
      const result = await fetchApi('/api/analysis/run', {
        method: 'POST',
        body: formData, // fetch will automatically set the correct multipart/form-data boundary
      });

      // Redirect to report page
      if (result.submission_id) {
        localStorage.setItem(`report_${result.submission_id}`, JSON.stringify(result));
        router.push(`/reports/${result.submission_id}`);
      } else {
        throw new Error('Analysis did not return a submission ID.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
      setLoading(false);
      setProgress('');
    }
  };

  useEffect(() => {
    if (!loading) return;
    
    // Cycle through descriptive stages to prevent UI freezing
    const stages = [
      'Uploading document...',
      'Extracting and parsing text...',
      'Running AI linguistic analysis...',
      'Comparing writing fingerprint...',
      'Generating instructor report...'
    ];
    
    let currentStage = 0;
    setProgress(stages[0]);
    
    const interval = setInterval(() => {
      currentStage = Math.min(currentStage + 1, stages.length - 1);
      setProgress(stages[currentStage]);
    }, 8000); // Progress stage roughly every 8 seconds
    
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">New Submission</h1>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Student ID</label>
            <input 
              type="text" 
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-400"
              placeholder="e.g. stu_12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Assignment Name</label>
            <input 
              type="text" 
              required
              value={assignmentName}
              onChange={(e) => setAssignmentName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-400"
              placeholder="e.g. Final Essay"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Document (TXT, PDF, DOCX)</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload a file</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".txt,.pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  {file ? file.name : "TXT, PDF, DOCX up to 10MB"}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">{loading && progress}</span>
            <button
              type="submit"
              disabled={loading || !file}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
