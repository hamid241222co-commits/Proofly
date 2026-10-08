'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, FileText, AlertTriangle, Users } from 'lucide-react';

export default function InstructorDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    students: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchDashboardData();
      }
    });
  }, [router, supabase]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch recent submissions
      const { data: subsData, error: subsError } = await supabase
        .from('submissions')
        .select(`
          id, 
          assignment_name, 
          created_at,
          status,
          students ( student_identifier ),
          reports ( risk_level, overall_risk_score )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (subsError) throw subsError;
      setSubmissions(subsData || []);
      
      // 2. Fetch counts for dashboard stats
      const { count: totalSubs } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true });
        
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
        
      const { count: highRisk } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'HIGH');
        
      const { count: mediumRisk } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'MEDIUM');
        
      const { count: lowRisk } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'LOW');

      setStats({
        total: totalSubs || 0,
        high: highRisk || 0,
        medium: mediumRisk || 0,
        low: lowRisk || 0,
        students: totalStudents || 0
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const dashboardStats = [
    { name: 'Total Submissions', stat: stats.total, icon: FileText },
    { name: 'Low Risk', stat: stats.low, icon: Shield },
    { name: 'Medium Risk', stat: stats.medium, icon: AlertTriangle },
    { name: 'High Risk', stat: stats.high, icon: AlertTriangle },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">Overview of student submissions and risk alerts.</p>
        </div>
        <Link href="/submissions/new" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
            Upload Submission for Analysis
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {dashboardStats.map((item) => (
          <div key={item.name} className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div className="absolute rounded-md bg-indigo-500 p-3">
                <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
            </dd>
          </div>
        ))}
      </dl>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Submissions</h3>
        </div>
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No submissions analyzed yet.
            </div>
          ) : (
            <ul role="list" className="divide-y divide-gray-200">
              {submissions.map((sub) => {
                const report = Array.isArray(sub.reports) ? sub.reports[0] : sub.reports;
                const student = Array.isArray(sub.students) ? sub.students[0] : sub.students;
                const riskLevel = report?.risk_level || 'UNKNOWN';
                const riskScore = typeof report?.overall_risk_score === 'number' 
                  ? report.overall_risk_score.toFixed(2) + '%' 
                  : 'N/A';
                  
                const riskColor = riskLevel === 'HIGH' ? 'text-red-700 bg-red-50 border-red-200' :
                                  riskLevel === 'MEDIUM' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
                                  riskLevel === 'LOW' ? 'text-green-700 bg-green-50 border-green-200' :
                                  'text-gray-700 bg-gray-50 border-gray-200';

                return (
                  <li key={sub.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {sub.assignment_name}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${riskColor}`}>
                              {riskLevel} ({riskScore})
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              <Users className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" aria-hidden="true" />
                              Student ID: {student?.student_identifier || 'Unknown'}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              {new Date(sub.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-5 flex-shrink-0">
                        <Link
                          href={`/reports/${sub.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          View Report
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
