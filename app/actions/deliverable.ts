"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BUCKET_NAME } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/* -------------------------------------------------------------------------- */
/*  Deliverable CRUD                                                          */
/*                                                                            */
/*  NOTE: file binaries never pass through this module. The browser uploads   */
/*  straight to Supabase Storage, then patches the row metadata itself (see   */
/*  components/dashboard/deliverable-manager.tsx). A Server Action request     */
/*  body is capped at ~1 MB, so funnelling a 50 MB file through here would    */
/*  fail regardless of intent.                                                */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, "Give the deliverable a title")
    .max(160, "Title is too long"),
  description: z
    .string()
    .trim()
    .max(4000, "Description is too long")
    .optional()
    .or(z.literal("")),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),
  share: z.string().optional(), // "1" => push straight to pending_review
});

export async function createDeliverable(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    share: formData.get("share") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, workspace_id")
    .eq("id", parsed.data.clientId)
    .maybeSingle();

  if (!client || client.workspace_id !== parsed.data.workspaceId) {
    return { ok: false, message: "That client is not in your workspace." };
  }

  const status = parsed.data.share === "1" ? "pending_review" : "draft";

  const { data: deliverable, error } = await supabase
    .from("deliverables")
    .insert({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      due_date: parsed.data.dueDate || null,
      status,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    // The caller needs the id to build the storage object path.
    id: deliverable.id,
    message: status === "pending_review" ? "Deliverable shared with client." : "Deliverable saved as draft.",
  };
}

const updateStatusSchema = z.object({
  deliverableId: z.string().uuid(),
  clientId: z.string().uuid(),
  status: z.enum(["draft", "pending_review", "changes_requested", "approved"]),
});

/** Agency-side status transitions (share, resubmit, unshare, reopen). */
export async function updateDeliverableStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateStatusSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    clientId: formData.get("clientId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid status update." };

  const supabase = createClient();

  const { data: owned } = await supabase
    .from("deliverables")
    .select("id, status, revision")
    .eq("id", parsed.data.deliverableId)
    .eq("client_id", parsed.data.clientId)
    .maybeSingle();

  if (!owned) return { ok: false, message: "Deliverable not found in your workspace." };

  const patch: Record<string, unknown> = { status: parsed.data.status };

  if (parsed.data.status === "pending_review" && owned.status !== "pending_review") {
    // Resubmission: clear the previous round of feedback, bump the revision.
    patch.client_feedback = null;
    patch.feedback_at = null;
    patch.revision = (owned.revision ?? 1) + 1;
  }

  if (parsed.data.status !== "approved") {
    patch.approved_at = null;
  }

  const { error } = await supabase
    .from("deliverables")
    .update(patch)
    .eq("id", parsed.data.deliverableId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  revalidatePath("/dashboard");

  return { ok: true, message: "Status updated." };
}

const updateMetaSchema = z.object({
  deliverableId: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function updateDeliverableMeta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateMetaSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message };

  const supabase = createClient();

  const { error } = await supabase
    .from("deliverables")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.deliverableId)
    .eq("client_id", parsed.data.clientId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  return { ok: true, message: "Deliverable updated." };
}

const deleteSchema = z.object({
  deliverableId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export async function deleteDeliverable(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    clientId: formData.get("clientId"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid deliverable." };

  const supabase = createClient();

  const { data: row } = await supabase
    .from("deliverables")
    .select("file_path")
    .eq("id", parsed.data.deliverableId)
    .eq("client_id", parsed.data.clientId)
    .maybeSingle();

  const { error } = await supabase
    .from("deliverables")
    .delete()
    .eq("id", parsed.data.deliverableId);

  if (error) return { ok: false, message: error.message };

  if (row?.file_path) {
    await supabase.storage.from(BUCKET_NAME).remove([row.file_path]);
  }

  revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Deliverable deleted." };
}
