/**
 * Environment contract.
 *
 * The build MUST NOT hard-fail when Supabase variables are missing, otherwise
 * `vercel build` / `npm run build` cannot run before the secrets are wired up.
 * We validate lazily and surface a friendly error at request time instead.
 */

export const env = {
  get supabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get supabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  },
  get supabaseServiceRoleKey(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get resendApiKey(): string {
    return process.env.RESEND_API_KEY ?? "";
  },
  /** Optional: override the magic-link origin (defaults to VERCEL_URL). */
  get appUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    if (explicit) return explicit;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  },
  /** Verified Resend sender. Falls back to onboarding@resend.dev (free sandbox). */
  get emailFrom(): string {
    return process.env.RESEND_FROM_EMAIL ?? "ClientSync <onboarding@resend.dev>";
  },
  get appName(): string {
    return process.env.NEXT_PUBLIC_APP_NAME ?? "ClientSync";
  },
};

export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const isResendConfigured = () => Boolean(env.resendApiKey);

export function missingEnvReport(): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!env.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

export const BUCKET_NAME = "deliverables_bucket";
export const PORTAL_TOKEN_HEADER = "x-portal-token";
