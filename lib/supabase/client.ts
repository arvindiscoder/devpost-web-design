import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Browser Supabase client.
 *
 * Used inside Client Components. Session is persisted in cookies so that
 * `@supabase/ssr` + the root middleware can refresh it server-side.
 */
export function createClient() {
  return createBrowserClient(
    env.supabaseUrl || "https://placeholder.supabase.co",
    env.supabaseAnonKey || "placeholder-anon-key",
  );
}

/**
 * Passwordless portal browser client.
 *
 * The `/portal/<access_token>` page has no Supabase session — the access token
 * itself is the credential. We forward it as the `x-portal-token` request
 * header, which is what the RLS policies in `0001_init.sql` read through
 * `public.portal_token()`. That is what makes an `anon` role read/update
 * exactly one client's rows and nothing else.
 */
export function createPortalClient(accessToken: string) {
  return createBrowserClient(
    env.supabaseUrl || "https://placeholder.supabase.co",
    env.supabaseAnonKey || "placeholder-anon-key",
    {
      global: {
        headers: { "x-portal-token": accessToken },
      },
    },
  );
}
