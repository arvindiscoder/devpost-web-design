"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, MailCheck, Sparkles } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import {
  Alert,
  AlertDescription,
  AlertIcon,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithGoogle, signUp } from "@/app/actions/auth";
import { IDLE, type ActionState } from "@/lib/action-state";

const HIGHLIGHTS = [
  "Passwordless client portals — no account for your client, ever",
  "One-click magic links backed by 122-bit access tokens",
  "Deliverable uploads that go straight to Supabase Storage",
  "Automatic Resend alerts the moment a client approves",
  "100% free-tier infrastructure, and no credit card",
];

/** Google's brand mark, inlined so no icon dependency ships a 4th colour. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ActionState>(IDLE);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const next = searchParams.get("next") ?? "/dashboard";
  const confirmEmail = searchParams.get("message") === "confirm-email";
  const registered = searchParams.get("registered") === "1";
  const oauthError = searchParams.get("error");

  useEffect(() => {
    if (confirmEmail) setNeedsConfirmation(true);
  }, [confirmEmail]);

  async function onSubmit(formData: FormData) {
    const result =
      mode === "login"
        ? await signIn(state, formData)
        : await signUp(state, formData);
    setState(result);
  }

  if (needsConfirmation) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            Your Supabase project has &ldquo;Confirm email&rdquo; enabled. Open
            the link we sent, then come back here to sign in — or skip the email
            entirely with Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full">
              <GoogleMark />
              Continue with Google instead
            </Button>
          </form>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
          <p className="text-center text-xs text-slate-500">
            Didn&apos;t get it? The Supabase free tier allows a few emails per
            hour — check spam and try again in a minute.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isLogin = mode === "login";

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader>
        <CardTitle>
          {isLogin ? "Welcome back" : "Create your workspace"}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Sign in to manage your clients and deliverables."
            : "Start your free trial. No credit card required."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {oauthError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertIcon variant="destructive" />
            <AlertDescription>
              {oauthError === "google_unavailable"
                ? "Google sign-in isn't configured yet. Ask the operator to enable the Google provider in Supabase, or use email and password below."
                : "That sign-in link is no longer valid. Please try again."}
            </AlertDescription>
          </Alert>
        ) : null}

        <form action={signInWithGoogle} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" className="w-full">
            <GoogleMark />
            Continue with Google
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-400">
            or use email
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form action={onSubmit} className="space-y-4">
          {registered ? (
            <Alert variant="success">
              <AlertIcon variant="success" />
              <AlertDescription>
                Account created. Confirm your email, then sign in.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.message && !state.ok ? (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <input type="hidden" name="next" value={next} />

          {!isLogin ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Arvind Sainathan"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Agency name</Label>
                <Input
                  id="workspaceName"
                  name="workspaceName"
                  placeholder="Sainathan Studio"
                  autoComplete="organization"
                  required
                  minLength={2}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@agency.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={8}
            />
            {!isLogin ? (
              <p className="text-xs text-slate-500">
                At least 8 characters. Supabase hashes it with bcrypt.
              </p>
            ) : null}
          </div>

          {!isLogin ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          ) : null}

          <SubmitButton
            className="w-full"
            pendingText={isLogin ? "Signing in…" : "Creating account…"}
          >
            {isLogin ? "Sign in" : "Create free account"}
            <ArrowRight className="h-4 w-4" />
          </SubmitButton>

          <p className="text-center text-sm text-slate-600">
            {isLogin ? (
              <>
                New to ClientSync?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function AuthHighlights() {
  return (
    <div className="hidden lg:block">
      <span className="inline-flex animate-in fade-in items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
        <Sparkles className="h-3.5 w-3.5" />
        Zero-cost by design
      </span>
      <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900">
        Stop building portals.
        <br />
        Start using them.
      </h2>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">
        ClientSync runs entirely on free tiers — Vercel Hobby, Supabase Free
        and Resend&apos;s 3,000 emails a month. Here is what you get for
        exactly $0.
      </p>
      <ul className="mt-8 space-y-3">
        {HIGHLIGHTS.map((point) => (
          <li key={point} className="flex items-start gap-3 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
