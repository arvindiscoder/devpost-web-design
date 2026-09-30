import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Root middleware — session refresh + route protection.
 *
 * Supabase access tokens are short-lived. Without a refresh on every request,
 * Server Components would randomly see a logged-out user. This middleware
 * revalidates the session with Supabase Auth and writes refreshed cookies
 * back onto the outgoing response.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // Route classification happens first so an unreachable Supabase project can
  // never 500 the public landing page or the static metadata routes.
  // The passwordless portal is public: it authenticates with an access token,
  // never with a Supabase session. Never redirect away from it.
  const isPortal = pathname.startsWith("/portal");
  // Route handlers authenticate themselves (session cookie or x-cron-secret),
  // so redirecting them to /login would break cron and webhook callers.
  const isApiRoute = pathname.startsWith("/api");
  const isPublicPage = pathname === "/";
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth");

  let user: { id: string } | null = null;

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    try {
      // Touching the user is what actually triggers the refresh.
      const result = await supabase.auth.getUser();
      user = result.data.user;
    } catch (error) {
      // Network hiccup or a rotated project key: degrade to "no session"
      // rather than taking the whole site down with a 500.
      console.error("[middleware] session refresh failed:", error);
    }
  }

  if (!user && !isPortal && !isApiRoute && !isPublicPage && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - _next/static, _next/image  (build artefacts)
     *  - favicon.ico, robots.txt, sitemap.xml, manifest.webmanifest
     *  - public assets (.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
