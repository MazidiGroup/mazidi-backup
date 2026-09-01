import { createClient } from '@supabase/supabase-js';

// Server-only client. The service role key bypasses RLS, so this module
// must never be imported into a client component.
export function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}
