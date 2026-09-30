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
import { signIn, signUp } from "@/app/actions/auth";
import { IDLE, type ActionState } from "@/lib/action-state";

const HIGHLIGHTS = [
  "Passwordless client portals — no account for your client, ever",
  "One-click magic links backed by 122-bit access tokens",
  "Deliverable uploads that go straight to Supabase Storage",
  "Automatic Resend alerts the moment a client approves",
  "100% free-tier infrastructure, and no credit card",
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ActionState>(IDLE);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const next = searchParams.get("next") ?? "/dashboard";
  const confirmEmail = searchParams.get("message") === "confirm-email";
  const registered = searchParams.get("registered") === "1";

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
            the link we sent, then come back here to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
