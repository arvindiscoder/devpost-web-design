import type { Metadata } from "next";
import { AlertCircle, Clock, Paperclip, ShieldCheck } from "lucide-react";

import { LogoMark } from "@/components/brand";
import { PortalDeliverables } from "@/components/portal/portal-deliverables";
import { Badge } from "@/components/ui/badge";
import { getPortalPayload } from "@/app/actions/portal";

export const dynamic = "force-dynamic";

type Params = { params: { access_token: string } };

export function generateMetadata({ params }: Params): Metadata {
  // Never leak the access token into <title> or any metadata.
  void params;
  return {
    title: "Client Portal",
    description: "Review deliverables and approve work with one click.",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PortalPage({ params }: Params) {
  const payload = await getPortalPayload(params.access_token);

  /* ------------------------------------------------------------------ */
  /*  Invalid / revoked link                                             */
  /* ------------------------------------------------------------------ */
  if (!payload) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6">
        <div className="pointer-events-none absolute inset-0 grid-backdrop [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            This portal link isn&apos;t valid
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The link may have been revoked, rotated, or it could have been
            mistyped. Ask your agency to send you a fresh one — it takes them
            about ten seconds.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected by ClientSync
          </div>
        </div>
      </main>
    );
  }

  const { client, workspace, deliverables } = payload;
  const accent = workspace.accent_color ?? "#4f46e5";
  const firstName = client.name.split(" ")[0];
  const pendingCount = deliverables.filter(
    (d) => d.status === "pending_review",
  ).length;
  const approvedCount = deliverables.filter(
    (d) => d.status === "approved",
  ).length;
  const changesCount = deliverables.filter(
    (d) => d.status === "changes_requested",
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Agency header */}
      <header className="border-b border-slate-200 bg-white">
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {workspace.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspace.logo_url}
                alt={workspace.name}
                className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {workspace.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {workspace.name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {client.project_title ?? "Client project"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Client portal
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Greeting */}
        <section className="mb-8">
          <p className="text-sm text-slate-500">
            Welcome back, {client.name}
          </p>
          <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Hi {firstName}, here&apos;s your work from{" "}
            <span style={{ color: accent }}>{workspace.name}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-balance text-slate-600">
            Review each item below. Approving takes one click and is
            timestamped; requesting changes lets you leave written feedback
            your agency sees instantly.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {deliverables.length === 0 ? null : (
              <>
                {pendingCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {pendingCount} awaiting your review
                  </Badge>
                ) : null}
                {approvedCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800"
                  >
                    {approvedCount} approved
                  </Badge>
                ) : null}
                {changesCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-rose-200 bg-rose-50 text-rose-800"
                  >
                    {changesCount} in revision
                  </Badge>
                ) : null}
              </>
            )}
          </div>
        </section>

        {deliverables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Paperclip className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Nothing to review yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              {workspace.name} hasn&apos;t shared any deliverables with you.
              You&apos;ll get an email the moment something is ready.
            </p>
          </div>
        ) : (
          <PortalDeliverables
            accessToken={params.access_token}
            clientName={client.name}
            clientEmail={client.email}
            workspaceName={workspace.name}
            accent={accent}
            initialDeliverables={deliverables}
          />
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-200 pt-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <LogoMark className="h-6 w-6" />
            <p className="text-sm text-slate-600">
              Shared by {workspace.name} via{" "}
              <span className="font-medium">ClientSync</span>
            </p>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            This is a private, password-free link. Please don&apos;t forward it.
          </p>
        </footer>
      </main>
    </div>
  );
}
