"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudUpload,
  Download,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_META } from "@/lib/status";
import { BUCKET_NAME } from "@/lib/env";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Deliverable, Signoff } from "@/lib/types";
import {
  MAX_FILE_BYTES,
  fileKindOf,
  formatBytes,
  formatDateTime,
  isAllowedMimeType,
  sanitizeFileName,
} from "@/lib/utils";
import {
  createDeliverable,
  deleteDeliverable,
  updateDeliverableStatus,
} from "@/app/actions/deliverable";
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

export function DeliverableManager({
  workspaceId,
  clientId,
  clientName,
  clientEmail,
  initialDeliverables,
  portalUrl,
  signoffs,
}: {
  workspaceId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  initialDeliverables: Deliverable[];
  portalUrl: string;
  signoffs: Record<string, Signoff>;
}) {
  const supabase = React.useMemo(() => createBrowserClient(), []);

  const [items, setItems] = React.useState(initialDeliverables);
  const [formState, setFormState] = React.useState<ActionState>(IDLE);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [newFile, setNewFile] = React.useState<File | null>(null);
  const [replacingId, setReplacingId] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setItems(initialDeliverables), [initialDeliverables]);

  /* ---------------------------------------------------------------------- */
  /*  Realtime: mirror the portal's decisions live                          */
  /* ---------------------------------------------------------------------- */
  React.useEffect(() => {
    const channel = supabase
      .channel(`deliverables:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliverables",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const next = payload.new as Deliverable;
          const evt = payload.eventType;

          if (evt === "DELETE") {
            const gone = payload.old as { id: string };
            setItems((prev) => prev.filter((row) => row.id !== gone.id));
            return;
          }

          setItems((prev) => {
            const index = prev.findIndex((row) => row.id === next.id);
            if (index === -1) return [next, ...prev];
            const copy = [...prev];
            copy[index] = { ...copy[index], ...next };
            return copy;
          });

          if (evt === "UPDATE" && next.status !== "draft") {
            const meta = STATUS_META[next.status];
            if (next.status === "approved") {
              toast.success(`Approved by ${clientName}`, {
                description: next.title,
              });
            } else if (next.status === "changes_requested") {
              toast.warning(`Changes requested on ${next.title}`, {
                description: next.client_feedback ?? meta.description,
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, clientName, supabase]);

  /* ---------------------------------------------------------------------- */
  /*  Direct-to-Storage upload with progress                                */
  /* ---------------------------------------------------------------------- */
  async function uploadToStorage(file: File, deliverableId: string) {
    const path = `${workspaceId}/${clientId}/${deliverableId}-${Date.now()}-${sanitizeFileName(file.name)}`;

    // supabase-js gives us a real progress callback for free.
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (error) throw new Error(error.message);

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return { url: urlData.publicUrl, path, name: file.name, size: file.size, type: file.type };
  }

  async function onCreate(formData: FormData) {
    const file = newFile;

    // Validate the binary here so a bad file never creates an orphan row.
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(
          `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 50 MB.`,
        );
        return;
      }
      if (!isAllowedMimeType(file.type)) {
        toast.error(`Files of type "${file.type || "unknown"}" are not allowed.`);
        return;
      }
    }

    // 1. Create the row first so we have an id for the storage path.
    const result = await createDeliverable(formState, formData);
    setFormState(result);

    if (!result.ok) {
      if (result.message) toast.error(result.message);
      return;
    }

    // 2. Upload the binary and patch the row with the file metadata.
    if (file && file.size > 0 && result.id) {
      setUploading(true);
      try {
        setProgress(35);
        const uploaded = await uploadToStorage(file, result.id);
        setProgress(80);

        const { error: patchError } = await supabase
          .from("deliverables")
          .update({
            file_url: uploaded.url,
            file_path: uploaded.path,
            file_name: uploaded.name,
            file_size: uploaded.size,
            file_type: uploaded.type,
          })
          .eq("id", result.id);

        if (patchError) throw new Error(patchError.message);

        setProgress(100);
      } catch (caught) {
        toast.error(
          `Deliverable created, but the file upload failed: ${
            caught instanceof Error ? caught.message : "unknown error"
          }`,
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    }

    toast.success(result.message ?? "Deliverable created");
    formRef.current?.reset();
    setNewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function replaceFile(deliverableId: string, file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`That file is larger than the 50 MB limit.`);
      return;
    }

    setBusyId(deliverableId);
    setProgress(10);

    try {
      const existing = items.find((row) => row.id === deliverableId);
      const uploaded = await uploadToStorage(file, deliverableId);
      setProgress(70);

      const { error } = await supabase
        .from("deliverables")
        .update({
          file_url: uploaded.url,
          file_path: uploaded.path,
          file_name: uploaded.name,
          file_size: uploaded.size,
          file_type: uploaded.type,
        })
        .eq("id", deliverableId);

      if (error) throw new Error(error.message);

      // Clean up the previous object so the bucket does not leak storage.
      if (existing?.file_path && existing.file_path !== uploaded.path) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([existing.file_path]);
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === deliverableId
            ? {
                ...row,
                file_url: uploaded.url,
                file_path: uploaded.path,
                file_name: uploaded.name,
                file_size: uploaded.size,
                file_type: uploaded.type,
              }
            : row,
        ),
      );

      setProgress(100);
      toast.success("New version uploaded", {
        description: "Resubmit for review to notify your client.",
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Upload failed",
      );
    } finally {
      setReplacingId(null);
      setBusyId(null);
      setProgress(0);
    }
  }

  async function setStatus(
    deliverableId: string,
    status: Deliverable["status"],
  ) {
    setBusyId(deliverableId);
    const fd = new FormData();
    fd.set("deliverableId", deliverableId);
    fd.set("clientId", clientId);
    fd.set("status", status);

    const result = await updateDeliverableStatus(formState, fd);
    setFormState(result);
    setBusyId(null);

    if (result.ok) {
      toast.success(result.message ?? "Status updated");
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  async function remove(deliverableId: string) {
    setBusyId(deliverableId);
    const fd = new FormData();
    fd.set("deliverableId", deliverableId);
    fd.set("clientId", clientId);

    const result = await deleteDeliverable(formState, fd);
    setFormState(result);
    setBusyId(null);

    if (result.ok) {
      setItems((prev) => prev.filter((row) => row.id !== deliverableId));
      toast.success("Deliverable deleted");
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  /* ---------------------------------------------------------------------- */

  const pendingCount = items.filter((d) => d.status === "pending_review").length;
  const changesCount = items.filter(
    (d) => d.status === "changes_requested",
  ).length;

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            Upload a deliverable
          </CardTitle>
          <CardDescription>
            Files go straight from your browser to Supabase Storage — no
            serverless function buffers the payload. Max 50 MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={onCreate} className="space-y-4">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="clientId" value={clientId} />

            {formState.message && !formState.ok ? (
              <Alert variant="destructive">
                <AlertIcon variant="destructive" />
                <AlertDescription>{formState.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Homepage concept v1"
                  required
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date (optional)</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={4000}
                placeholder="What should your client look at? Any specific questions?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                onChange={(event) => {
                  const picked = event.target.files?.[0] ?? null;
                  setNewFile(picked);
                  if (picked) {
                    if (picked.size > MAX_FILE_BYTES) {
                      toast.error(
                        `"${picked.name}" is ${(picked.size / 1024 / 1024).toFixed(1)} MB — the limit is 50 MB.`,
                      );
                    } else if (!isAllowedMimeType(picked.type)) {
                      toast.error(
                        `Files of type "${picked.type || "unknown"}" are not allowed.`,
                      );
                    }
                  }
                }}
              />
              {newFile ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  {newFile.name} · {formatBytes(newFile.size)}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  PDF, images, video, audio, Office docs and zip. 50 MB max.
                </p>
              )}
              <p className="text-xs text-slate-400">
                The file is uploaded directly from your browser to Supabase
                Storage — it never touches our server.
              </p>
            </div>

            {uploading ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading to Supabase Storage…
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <SubmitButton
                pendingText={uploading ? "Uploading…" : "Saving…"}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                Save as draft
              </SubmitButton>

              <Button type="submit" name="share" value="1" disabled={uploading}>
                <Send className="h-4 w-4" />
                Share with {clientName.split(" ")[0]}
              </Button>

              <span className="text-xs text-slate-500">
                Drafts are invisible to the client until you share them.
              </span>
            </div>
          </form>
        </CardContent>
      </Card>

      {changesCount > 0 ? (
        <Alert variant="warning">
          <AlertIcon variant="warning" />
          <AlertDescription>
            {changesCount} deliverable{changesCount === 1 ? "" : "s"} waiting on
            a new version. Upload a replacement, then hit{" "}
            <strong>Resubmit for review</strong>.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Deliverable list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Deliverables{" "}
            <span className="text-sm font-normal text-slate-500">
              ({items.length})
            </span>
          </h2>
          {pendingCount > 0 ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800"
            >
              {pendingCount} awaiting client
            </Badge>
          ) : null}
        </div>

        {items.length === 0 ? (
          <Alert variant="info">
            <AlertIcon variant="info" />
            <AlertDescription>
              Nothing here yet. Upload your first deliverable above — it will
              appear in {clientName.split(" ")[0]}&apos;s portal the moment you
              share it.
            </AlertDescription>
          </Alert>
        ) : null}

        {items.map((item) => {
          const Icon = KIND_ICONS[fileKindOf(item.file_type, item.file_name)];
          const isBusy = busyId === item.id;
          const signoff = signoffs[item.id];

          return (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {item.title}
                        </p>
                        <StatusBadge status={item.status} />
                        {item.revision > 1 ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            v{item.revision}
                          </Badge>
                        ) : null}
                      </div>

                      {item.description ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                          {item.description}
                        </p>
                      ) : null}

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {item.file_name ? (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {item.file_name} · {formatBytes(item.file_size)}
                          </span>
                        ) : (
                          <span className="text-amber-600">No file attached</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Added {formatDateTime(item.created_at)}
                        </span>
                        {item.due_date ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due {formatDateTime(item.due_date)}
                          </span>
                        ) : null}
                      </p>

                      {STATUS_META[item.status].clientCanAct ? (
                        <p className="mt-1.5 text-xs text-amber-700">
                          Waiting on {clientName.split(" ")[0]} — they can see
                          this now.
                        </p>
                      ) : null}

                      {item.client_feedback ? (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-800">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Client feedback ·{" "}
                            {formatDateTime(item.feedback_at)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-rose-900">
                            {item.client_feedback}
                          </p>
                        </div>
                      ) : null}

                      {item.status === "approved" && item.approved_at ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved {formatDateTime(item.approved_at)}
                          {signoff ? ` · signed by ${signoff.signer_name}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {item.file_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          download={item.file_name ?? undefined}
                        >
                          <Download className="h-4 w-4" />
                          Open
                        </a>
                      </Button>
                    ) : null}

                    {item.status === "draft" ? (
                      <Button
                        size="sm"
                        onClick={() => setStatus(item.id, "pending_review")}
                        disabled={isBusy}
                      >
                        <Send className="h-4 w-4" />
                        Share
                      </Button>
                    ) : null}

                    {item.status === "changes_requested" ? (
                      <Button
                        size="sm"
                        onClick={() => setStatus(item.id, "pending_review")}
                        disabled={isBusy}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Resubmit
                      </Button>
                    ) : null}

                    {item.status === "approved" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(item.id, "pending_review")}
                        disabled={isBusy}
                      >
                        Reopen
                      </Button>
                    ) : null}

                    {item.status === "pending_review" ? (
                      <span className="text-xs text-slate-400">
                        Client decides
                      </span>
                    ) : null}

                    {replacingId === item.id ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.onchange = () => {
                            const file = input.files?.[0];
                            if (file) void replaceFile(item.id, file);
                          };
                          input.click();
                        }}
                        disabled={isBusy}
                        title="Upload a new version"
                      >
                        <RefreshCw className="h-4 w-4" />
                        New version
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${item.title}"? This cannot be undone.`,
                          )
                        ) {
                          void remove(item.id);
                        }
                      }}
                      disabled={isBusy}
                      aria-label="Delete deliverable"
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Portal link: {portalUrl} · {clientEmail}
        </p>
      ) : null}
    </div>
  );
}
