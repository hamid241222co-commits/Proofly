import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Ensure we strip /rest/v1 if it was accidentally appended in the environment variable
  const cleanUrl = url.replace(/\/rest\/v1\/?$/, '');

  return createBrowserClient(
    cleanUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
