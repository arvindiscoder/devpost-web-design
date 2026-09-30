import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Sign out. A POST route (not a link) so a prefetch or a stray <a> can never
 * log a user out by accident.
 */
export async function POST(request: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}

export async function GET(request: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url));
}
