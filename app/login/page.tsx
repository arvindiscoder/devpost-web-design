import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { AuthForm, AuthHighlights } from "@/components/auth/auth-form";
import { LogoMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your ClientSync workspace to manage clients, deliverables and approvals.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 grid-backdrop [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-32 right-0 h-[380px] w-[600px] rounded-full bg-violet-300/30 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <a href="/" className="inline-flex w-fit items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight">ClientSync</span>
        </a>

        <div className="grid flex-1 items-center gap-16 py-12 lg:grid-cols-2">
          <AuthHighlights />

          <div className="mx-auto w-full max-w-md">
            <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-xl" />}>
              <AuthForm mode="login" />
            </Suspense>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <KeyRound className="h-3.5 w-3.5" />
              Your clients never need a password — only you sign in here.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
