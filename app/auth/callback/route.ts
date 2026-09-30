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
  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(url);
  }

  await ensureWorkspace(supabase, session?.user);

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * A Google user has no `signUp` step, so nobody called `bootstrap_workspace`
 * for them and the dashboard would open on an empty state. Create their first
 * workspace here, named after the Google profile.
 *
 * Guarded twice: the profile is only used for a *first* workspace, and
 * `bootstrap_workspace` renames whatever it finds, so an existing workspace
 * must never reach it. Failures here are non-fatal -- the dashboard offers a
 * "create your first workspace" modal as a fallback.
 */
async function ensureWorkspace(
  supabase: ReturnType<typeof createClient>,
  user: { user_metadata?: Record<string, unknown>; email?: string } | undefined,
): Promise<void> {
  try {
    const { data: existing, error: readError } = await supabase
      .from("workspaces")
      .select("id")
      .limit(1);

    if (readError || !existing || existing.length > 0) return;

    const meta = user?.user_metadata ?? {};
    const name = [meta.full_name, meta.name]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 1)
      .map((v) => v.trim())
      .find((v) => v.length > 1);
    const label = (name ?? user?.email?.split("@")[0] ?? "My Studio")
      .slice(0, 80);

    await supabase.rpc("bootstrap_workspace", { p_workspace_name: label });
  } catch (error) {
    console.error("google workspace bootstrap skipped:", error);
  }
}

/** Blocks open-redirects: only allow same-origin, path-only targets. */
function sanitizeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
