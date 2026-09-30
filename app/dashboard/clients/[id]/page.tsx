import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  Inbox,
  MessageSquare,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { DeliverableManager } from "@/components/dashboard/deliverable-manager";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Deliverable, Signoff } from "@/lib/types";
import { formatDateTime, initialsOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export function generateMetadata({ params }: Params): Metadata {
  return { title: `Client ${params.id.slice(0, 8)}` };
}

export default async function ClientDetailPage({ params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", client.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.owner_id !== user.id) notFound();

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const rows = (deliverables ?? []) as Deliverable[];

  const { data: signoffs } = await supabase
    .from("signoffs")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const portalUrl = `${env.appUrl}/portal/${client.access_token}`;

  const stats = {
    total: rows.length,
    pending: rows.filter((d) => d.status === "pending_review").length,
    changes: rows.filter((d) => d.status === "changes_requested").length,
    approved: rows.filter((d) => d.status === "approved").length,
    drafts: rows.filter((d) => d.status === "draft").length,
  };

  const signoffByDeliverable = new Map<string, Signoff>();
  for (const signoff of (signoffs ?? []) as Signoff[]) {
    if (!signoffByDeliverable.has(signoff.deliverable_id)) {
      signoffByDeliverable.set(signoff.deliverable_id, signoff);
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="gap-2 -ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </Button>

      {/* Client header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
              {initialsOf(client.name)}
            </span>
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {client.name}
                {client.revoked_at ? (
                  <Badge variant="destructive">Access revoked</Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="mt-1">
                {client.email}
                {client.company ? ` · ${client.company}` : ""}
                {client.project_title ? ` · ${client.project_title}` : ""}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={portalUrl} label="Copy Magic Link" />
            <Button asChild variant="outline" size="sm">
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Preview portal
              </a>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {stats.total} total
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800"
            >
              <Inbox className="h-3.5 w-3.5" />
              {stats.pending} pending
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-rose-200 bg-rose-50 text-rose-800"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {stats.changes} changes
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800"
            >
              {stats.approved} approved
            </Badge>
            {stats.drafts > 0 ? (
              <Badge variant="outline" className="gap-1.5">
                {stats.drafts} draft{stats.drafts === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 ring-1 ring-slate-200">
            {portalUrl}
          </p>
        </CardContent>
      </Card>

      {/* Upload + realtime manager */}
      <DeliverableManager
        workspaceId={workspace.id}
        clientId={client.id}
        clientName={client.name}
        clientEmail={client.email}
        initialDeliverables={rows}
        portalUrl={portalUrl}
        signoffs={Object.fromEntries(signoffByDeliverable)}
      />

      {/* Feedback digest */}
      {rows.some((row) => row.client_feedback) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Latest client feedback
            </CardTitle>
            <CardDescription>
              Every comment a client has left, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows
              .filter((row) => row.client_feedback)
              .map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {row.title}
                    </p>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(row.feedback_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {row.client_feedback}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Sign-off audit trail */}
      {(signoffs ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Digital sign-off log</CardTitle>
            <CardDescription>
              Append-only audit trail. Clients cannot edit or delete these
              records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(signoffs as Signoff[]).map((signoff) => {
              const deliverable = rows.find(
                (row) => row.id === signoff.deliverable_id,
              );
              return (
                <div
                  key={signoff.id}
                  className="flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-emerald-900">
                      {signoff.signer_name}
                      <span className="ml-1.5 font-normal text-emerald-700">
                        ({signoff.signer_email})
                      </span>
                    </p>
                    <p className="text-xs text-emerald-700">
                      {deliverable?.title ?? "Deliverable"} ·{" "}
                      {formatDateTime(signoff.created_at)}
                      {signoff.ip_address ? ` · ${signoff.ip_address}` : ""}
                    </p>
                    {signoff.notes ? (
                      <p className="mt-1 text-xs italic text-emerald-800">
                        &ldquo;{signoff.notes}&rdquo;
                      </p>
                    ) : null}
                  </div>
                  <Badge className="shrink-0 border-emerald-200 bg-white text-emerald-800 hover:bg-white">
                    Signed
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {client.revoked_at ? (
        <Alert variant="warning">
          <AlertIcon variant="warning" />
          <AlertDescription>
            This client&apos;s portal link is revoked. The page still loads for
            you, but your client sees &ldquo;link not found&rdquo;. Re-enable
            access from the dashboard to restore it.
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="info">
        <AlertIcon variant="info" />
        <AlertDescription>
          <span className="font-medium">Realtime is on.</span> When your client
          approves or requests changes, the badges below update without a
          refresh — Supabase Realtime pushes the change straight to this page.
        </AlertDescription>
      </Alert>

      <p className="text-xs text-slate-400">
        Workspace: {workspace.name} · plan: {workspace.plan}
      </p>
    </div>
  );
}
