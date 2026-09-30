"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  PenLine,
  ShieldCheck,
  X,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_META } from "@/lib/status";
import { createPortalClient } from "@/lib/supabase/client";
import type { Deliverable } from "@/lib/types";
import { fileKindOf, formatBytes, formatDateTime } from "@/lib/utils";
import {
  approveDeliverable,
  requestChanges,
} from "@/app/actions/portal";
import { IDLE, type ActionState } from "@/lib/action-state";

const KIND_ICONS = {
  image: ImageIcon,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  archive: FileArchive,
  doc: FileText,
  file: Paperclip,
} as const;

export function PortalDeliverables({
  accessToken,
  clientName,
  clientEmail,
  workspaceName,
  accent,
  initialDeliverables,
}: {
  accessToken: string;
  clientName: string;
  clientEmail: string;
  workspaceName: string;
  accent: string;
  initialDeliverables: Deliverable[];
}) {
  // The portal browser client sends the access token as the x-portal-token
  // header, which is exactly what the RLS policies authorise.
  const supabase = React.useMemo(
    () => createPortalClient(accessToken),
    [accessToken],
  );

  const [items, setItems] = React.useState(initialDeliverables);
  const [state, setState] = React.useState<ActionState>(IDLE);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Approve modal
  const [approveTarget, setApproveTarget] = React.useState<Deliverable | null>(
    null,
  );
  // Request-changes modal
  const [changesTarget, setChangesTarget] = React.useState<Deliverable | null>(
    null,
  );

  const approveFormRef = React.useRef<HTMLFormElement>(null);
  const changesFormRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => setItems(initialDeliverables), [initialDeliverables]);

  /* ------------------------------------------------------------------ */
  /*  Realtime: pick up resubmissions while the client is still here    */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    const channel = supabase
      .channel(`portal:${accessToken}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliverables",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const gone = payload.old as { id: string };
            setItems((prev) => prev.filter((row) => row.id !== gone.id));
            return;
          }

          const next = payload.new as Deliverable;
          setItems((prev) => {
            const index = prev.findIndex((row) => row.id === next.id);
            if (index === -1) return prev;
            const copy = [...prev];
            copy[index] = { ...copy[index], ...next };
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accessToken, supabase]);

  /* ------------------------------------------------------------------ */
  /*  Approve                                                            */
  /* ------------------------------------------------------------------ */
  async function onApprove(formData: FormData) {
    if (!approveTarget) return;

    setBusyId(approveTarget.id);
    const result = await approveDeliverable(state, formData);
    setState(result);
    setBusyId(null);

    if (result.ok) {
      const approvedAt = new Date().toISOString();
      setItems((prev) =>
        prev.map((row) =>
          row.id === approveTarget.id
            ? {
                ...row,
                status: "approved",
                approved_at: approvedAt,
                client_feedback: null,
                feedback_at: null,
              }
            : row,
        ),
      );
      toast.success("Approved — thank you!", {
        description: `${workspaceName} has been notified by email.`,
      });
      setApproveTarget(null);
      approveFormRef.current?.reset();
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Request changes                                                    */
  /* ------------------------------------------------------------------ */
  async function onRequestChanges(formData: FormData) {
    if (!changesTarget) return;

    setBusyId(changesTarget.id);
    const result = await requestChanges(state, formData);
    setState(result);
    setBusyId(null);

    if (result.ok) {
      setItems((prev) =>
        prev.map((row) =>
          row.id === changesTarget.id
            ? {
                ...row,
                status: "changes_requested",
                client_feedback: String(formData.get("feedback") ?? ""),
                feedback_at: new Date().toISOString(),
              }
            : row,
        ),
      );
      toast.success("Feedback sent", {
        description: `${workspaceName} has been notified by email.`,
      });
      setChangesTarget(null);
      changesFormRef.current?.reset();
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  /* ------------------------------------------------------------------ */

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => {
          const Icon = KIND_ICONS[fileKindOf(item.file_type, item.file_name)];
          const meta = STATUS_META[item.status];
          const canAct = meta.clientCanAct;
          const isBusy = busyId === item.id;

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {item.file_name
                          ? `${item.file_name} · ${formatBytes(item.file_size)}`
                          : "No file attached"}
                        {item.revision > 1
                          ? ` · version ${item.revision}`
                          : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={item.status} className="shrink-0" />
                </div>
              </CardHeader>

              <CardContent className="pt-5">
                {item.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {item.description}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-slate-500">
                  {meta.description}
                  {item.due_date
                    ? ` Requested by ${formatDateTime(item.due_date)}.`
                    : ""}
                </p>

                {/* Your feedback */}
                {item.client_feedback ? (
                  <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-rose-800">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Your feedback · {formatDateTime(item.feedback_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-rose-900">
                      {item.client_feedback}
                    </p>
                  </div>
                ) : null}

                {/* Approval record */}
                {item.status === "approved" && item.approved_at ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-900">
                      <span className="font-medium">Signed off</span> by{" "}
                      {clientName} on {formatDateTime(item.approved_at)}
                    </p>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {item.file_url ? (
                    <Button asChild variant="outline" className="sm:w-auto">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        download={item.file_name ?? undefined}
                      >
                        <Download className="h-4 w-4" />
                        View / download
                      </a>
                    </Button>
                  ) : null}

                  {canAct ? (
                    <>
                      <Button
                        className="sm:w-auto"
                        style={{ backgroundColor: accent }}
                        onClick={() => setApproveTarget(item)}
                        disabled={isBusy}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve deliverable
                      </Button>
                      <Button
                        variant="outline"
                        className="sm:w-auto"
                        onClick={() => setChangesTarget(item)}
                        disabled={isBusy}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Request changes
                      </Button>
                    </>
                  ) : null}

                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : null}
                </div>

                {item.status === "changes_requested" ? (
                  <p className="mt-3 text-xs text-rose-700">
                    Your agency has been notified and will upload a new version.
                    You&apos;ll get an email when it&apos;s ready to review.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Approve dialog — digital sign-off                                */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => !open && setApproveTarget(null)}
      >
        <DialogContent>
          <form ref={approveFormRef} action={onApprove} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Approve this deliverable?</DialogTitle>
              <DialogDescription>
                {approveTarget ? (
                  <>
                    You are approving{" "}
                    <span className="font-medium text-slate-900">
                      {approveTarget.title}
                    </span>{" "}
                    from {workspaceName}. Type your full name to sign off — this
                    is recorded with a timestamp as a digital approval.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="accessToken" value={accessToken} />
            <input
              type="hidden"
              name="deliverableId"
              value={approveTarget?.id ?? ""}
            />

            {state.message && !state.ok ? (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="signerName">
                Your full name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="signerName"
                name="signerName"
                defaultValue={clientName}
                placeholder={clientName}
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
              <p className="text-xs text-slate-500">
                Signing as {clientEmail}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                name="note"
                rows={3}
                maxLength={2000}
                placeholder="Anything you want on the record with this approval?"
              />
            </div>

            <Alert variant="info">
              <AlertIcon variant="info" />
              <AlertDescription className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your approval is timestamped and stored in an append-only
                audit log. {workspaceName} will be emailed immediately.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setApproveTarget(null)}
              >
                Cancel
              </Button>
              <SubmitButton
                pendingText="Recording approval…"
                style={{ backgroundColor: accent }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve &amp; sign off
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/*  Request changes dialog — feedback                                */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={Boolean(changesTarget)}
        onOpenChange={(open) => !open && setChangesTarget(null)}
      >
        <DialogContent>
          <form ref={changesFormRef} action={onRequestChanges} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Request changes</DialogTitle>
              <DialogDescription>
                {changesTarget ? (
                  <>
                    Tell {workspaceName} what needs adjusting on{" "}
                    <span className="font-medium text-slate-900">
                      {changesTarget.title}
                    </span>
                    . Be specific — it gets emailed straight to them.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="accessToken" value={accessToken} />
            <input
              type="hidden"
              name="deliverableId"
              value={changesTarget?.id ?? ""}
            />

            {state.message && !state.ok ? (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="feedback">
                What needs to change? <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="feedback"
                name="feedback"
                rows={6}
                required
                minLength={3}
                maxLength={4000}
                placeholder="The hero section looks great. Two things: the headline is too long, and please swap the stock photo for the one from round two."
              />
              <p className="text-xs text-slate-500">
                Minimum 3 characters. Your agency is emailed immediately.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangesTarget(null)}
              >
                <CancelIcon />
                Cancel
              </Button>
              <SubmitButton pendingText="Sending feedback…" variant="destructive">
                <PenLine className="h-4 w-4" />
                Send feedback
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CancelIcon() {
  return <X className="h-4 w-4" />;
}
