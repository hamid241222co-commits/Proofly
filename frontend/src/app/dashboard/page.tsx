'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardRedirect() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Default to student if app_metadata role is not present in session
      // But in a real app with Supabase, roles can be placed in user_metadata or app_metadata
      // For this prototype, we'll check if they signed up as an instructor in user_metadata
      const role = session.user.app_metadata?.role || session.user.user_metadata?.role || 'student';
      
      if (role === 'instructor') {
        router.push('/instructor');
      } else {
        router.push('/student');
      }
    }
    checkUser();
  }, [router, supabase]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Redirecting to your dashboard...</div>;
  }

  return null;
}
