import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS by design, so it is restricted to trusted server code only
 * (server actions + the Resend route handler). Every call site MUST perform its
 * own ownership / token validation first.
 */
export function createAdminClient() {
  const key = env.supabaseServiceRoleKey;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  return createSupabaseClient(env.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isAdminConfigured(): boolean {
  return Boolean(env.supabaseServiceRoleKey && env.supabaseUrl);
}
