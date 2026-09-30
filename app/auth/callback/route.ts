import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation landing route.
 *
 * Supabase redirects here with `?code=...`; we exchange it for a session and
 * forward to the dashboard. The middleware then refreshes cookies on the way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next")) ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${env.appUrl}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Blocks open-redirects: only allow same-origin, path-only targets. */
function sanitizeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
