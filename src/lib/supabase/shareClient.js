/**
 * Anon Supabase client that sends Harbor's unlisted-read header.
 * RLS uses private.request_share_token() ← request.headers->>'x-share-token'.
 */
import { createClient } from "@supabase/supabase-js";

export function createShareClient(shareToken) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-share-token": String(shareToken || ""),
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
