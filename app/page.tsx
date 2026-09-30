import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileUp,
  Gauge,
  Lock,
  Mail,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { LogoMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Copy,
    title: "Magic links, zero friction",
    body: "Every client gets a unique, high-entropy access token. No password to forget, no account to create, no onboarding email bounce to chase.",
  },
  {
    icon: MousePointerClick,
    title: "Approvals in two clicks",
    body: "Your client opens the link, reads the deliverable, and hits Approve or Request Changes. The decision and a timestamped sign-off land in your dashboard instantly.",
  },
  {
    icon: FileUp,
    title: "Direct-to-storage uploads",
    body: "Files go straight from the browser to Supabase Storage. No serverless function ever buffers a 50 MB payload, so you stay well inside free-tier limits.",
  },
  {
    icon: Mail,
    title: "Automatic notifications",
    body: "Resend emails the agency the moment a client approves or requests changes, with the feedback inlined so nothing gets lost in a thread.",
  },
  {
    icon: ShieldCheck,
    title: "Row Level Security",
    body: "Postgres policies guarantee an agency can only touch its own rows, and a portal link can only touch its own deliverables — enforced in the database, not the UI.",
  },
  {
    icon: Gauge,
    title: "Live status badges",
    body: "Supabase Realtime pushes status changes to both screens, so the agency's dashboard updates while the client is still looking at the page.",
  },
];

const FLOW = [
  {
    step: "01",
    title: "Create your workspace",
    body: "Sign up with an email and password. A workspace and a 14-day Pro trial are created atomically with your account.",
  },
  {
    step: "02",
    title: "Add a client",
    body: "Name + email is enough. ClientSync mints a uuid v4 access token and builds the portal URL for you.",
  },
  {
    step: "03",
    title: "Copy the magic link",
    body: "One click puts https://your-domain/portal/<token> on the clipboard. Paste it into any email, DM or invoice.",
  },
  {
    step: "04",
    title: "Upload deliverables",
    body: "Files land in a Supabase Storage bucket scoped to your workspace. Drafts stay private; sharing flips them to Pending Review.",
  },
  {
    step: "05",
    title: "Client approves or requests changes",
    body: "No account, no password. The client approves with a typed sign-off, or leaves written feedback. You are emailed either way.",
  },
];

const STACK = [
  { label: "Next.js 14 App Router", value: "Vercel Hobby" },
  { label: "Supabase Postgres + Auth + Storage", value: "Free tier" },
  { label: "Supabase Realtime", value: "Free tier" },
  { label: "Tailwind CSS + shadcn/ui", value: "Open source" },
  { label: "Resend", value: "3,000 emails / mo" },
  { label: "Total infrastructure cost", value: "$0.00" },
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-semibold tracking-tight">
              ClientSync
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 grid-backdrop [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-400/25 blur-[120px]" />
          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="outline"
                className="mb-6 gap-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                100% free-tier infrastructure · no credit card, ever
              </Badge>

              <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
                Client approvals that take
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  two clicks
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-600">
                ClientSync is a passwordless client portal for freelancers and
                agencies. Upload a deliverable, copy one magic link, and let
                your client approve it or ask for changes — without ever
                creating an account.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link href="/signup">
                    Create your free workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full sm:w-auto"
                >
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                Free forever: 5 clients, 1 GB of files, 3,000 emails/month.
              </p>
            </div>

            {/* Product preview */}
            <div className="mx-auto mt-16 max-w-4xl">
              <Card className="overflow-hidden border-slate-200 shadow-2xl shadow-slate-900/10">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 truncate rounded-md bg-white px-2.5 py-1 font-mono text-xs text-slate-500 ring-1 ring-slate-200">
                    your-agency.com/portal/8f3a…c21d
                  </span>
                </div>
                <CardContent className="space-y-3 bg-slate-50/60 p-6">
                  {[
                    {
                      title: "Brand Guidelines v2.pdf",
                      meta: "2.4 MB · uploaded 2 hours ago",
                      status: "Pending Review",
                      badge: "border-amber-200 bg-amber-50 text-amber-800",
                      dot: "bg-amber-500",
                    },
                    {
                      title: "Homepage Concept v3",
                      meta: "8.1 MB · uploaded yesterday",
                      status: "Approved",
                      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      dot: "bg-emerald-500",
                    },
                    {
                      title: "Logo Exploration.png",
                      meta: "3.2 MB · changes requested",
                      status: "Changes Requested",
                      badge: "border-rose-200 bg-rose-50 text-rose-800",
                      dot: "bg-rose-500",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500">{item.meta}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            item.badge,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />
                          {item.status}
                        </span>
                        <span className="hidden rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white sm:inline">
                          Approve
                        </span>
                        <span className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 sm:inline">
                          Request changes
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-200 bg-slate-50/70 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Built for the boring part of freelancing
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Everything ClientSync does exists to remove one specific
                annoyance: chasing a client for a yes or a no.
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-slate-200 bg-white transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {feature.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              <div>
                <Badge variant="secondary" className="mb-4">
                  <Zap className="h-3.5 w-3.5" />
                  Five steps
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  From empty workspace to signed-off deliverable
                </h2>
                <p className="mt-4 text-lg text-slate-600">
                  The whole loop takes about four minutes. Most of it is
                  uploading a file.
                </p>

                <div className="mt-10">
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    The $0 stack
                  </p>
                  <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                    {STACK.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <dt className="text-sm text-slate-700">{row.label}</dt>
                        <dd className="text-sm font-medium text-slate-900">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              <ol className="space-y-4">
                {FLOW.map((item) => (
                  <li
                    key={item.step}
                    className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-semibold text-white">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="border-t border-slate-200 bg-slate-900 py-20 text-slate-100">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  A magic link is only as safe as the database behind it
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-300">
                  ClientSync does not trust the browser. Every read and write
                  is authorised by Postgres Row Level Security policies, so a
                  tampered client cannot see another client&apos;s work even if
                  it crafts its own API calls.
                </p>
              </div>

              <ul className="space-y-4">
                {[
                  "122 bits of entropy per access token (uuid v4) — not guessable.",
                  "A trigger blocks portal clients from rewriting titles, files, or client links.",
                  "Sign-offs are an append-only ledger; revoking an approval is refused by the database.",
                  "Revoke a client's token and every outstanding link dies instantly.",
                  "The storage bucket is public-read but write-locked to authenticated workspace owners.",
                ].map((point) => (
                  <li key={point} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <span className="text-sm leading-relaxed text-slate-300">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Stop asking &ldquo;can you approve this?&rdquo;
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-slate-600">
              Set up your first client portal in under five minutes. Free
              forever, no card, cancel by deleting the repo.
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold">ClientSync</span>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-right">
            Built with Next.js, Supabase and Resend. Runs on $0 of infrastructure.
          </p>
        </div>
      </footer>
    </div>
  );
}
