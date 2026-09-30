import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * Server Supabase client bound to the request cookie jar.
 *
 * Use inside Server Components, Route Handlers and Server Actions.
 * Never import this into a Client Component.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    env.supabaseUrl || "https://placeholder.supabase.co",
    env.supabaseAnonKey || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: middleware already refreshed the
            // session, so this is safe to ignore. See middleware.ts.
          }
        },
      },
    },
  );
}
