"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import {
  approvalEmail,
  revisionRequestEmail,
} from "@/lib/email/templates";
import type {
  Client,
  Deliverable,
  PortalPayload,
  Workspace,
} from "@/lib/types";
import type { ActionState } from "@/lib/action-state";

/* -------------------------------------------------------------------------- */
/*  Reads                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Load everything the passwordless portal needs for one access token.
 *
 * The token is the ONLY credential — there is no Supabase session. We resolve
 * it with the service role (bypassing RLS) and then apply strict business
 * rules in code: revoked links get nothing, drafts are never exposed.
 */
export async function getPortalPayload(
  accessToken: string,
): Promise<PortalPayload | null> {
  const uuid = z.string().uuid().safeParse(accessToken);
  if (!uuid.success) return null;

  // A misconfigured deployment must render the "link isn't valid" page, not a
  // 500 stack trace — the token is a bearer credential, so there is nothing
  // useful to leak in an error page.
  if (!isSupabaseConfigured()) {
    console.error("[portal] Supabase is not configured — cannot resolve token.");
    return null;
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[portal] admin client unavailable:", error);
    return null;
  }

  const { data: client, error } = await admin
    .from("clients")
    .select("*")
    .eq("access_token", uuid.data)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !client) return null;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", client.workspace_id)
    .maybeSingle();

  if (!workspace) return null;

  // Clients must never see internal drafts.
  const { data: deliverables } = await admin
    .from("deliverables")
    .select("*")
    .eq("client_id", client.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  // Best-effort analytics touch; never block the render on it.
  await admin.rpc("touch_client", { p_token: uuid.data }).then(
    () => undefined,
    () => undefined,
  );

  return {
    client: client as Client,
    workspace: workspace as Workspace,
    deliverables: (deliverables ?? []) as Deliverable[],
  };
}

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                   */
/* -------------------------------------------------------------------------- */

const tokenParam = z.string().uuid();

function portalUrlFor(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return `${base ?? "http://localhost:3000"}/portal/${token}`;
}

const approveSchema = z.object({
  accessToken: tokenParam,
  deliverableId: z.string().uuid(),
  signerName: z
    .string()
    .trim()
    .min(2, "Type your full name to sign off")
    .max(120, "That name is too long"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

/**
 * Approve a deliverable.
 *
 * 1. Validate the token + the deliverable belongs to that client.
 * 2. Only `pending_review` items can be approved (DB trigger enforces too).
 * 3. Flip to `approved` and stamp `approved_at`.
 * 4. Write the append-only digital sign-off record.
 * 5. Email the agency owner via Resend.
 */
export async function approveDeliverable(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = approveSchema.safeParse({
    accessToken: formData.get("accessToken"),
    deliverableId: formData.get("deliverableId"),
    signerName: formData.get("signerName"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const { accessToken, deliverableId, signerName } = parsed.data;
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("access_token", accessToken)
    .is("revoked_at", null)
    .maybeSingle();

  if (!client) {
    return { ok: false, message: "This portal link is no longer valid." };
  }

  const { data: deliverable } = await admin
    .from("deliverables")
    .select("*")
    .eq("id", deliverableId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!deliverable) {
    return { ok: false, message: "Deliverable not found for this portal." };
  }

  if (deliverable.status === "approved") {
    return { ok: false, message: "This deliverable was already approved." };
  }

  if (deliverable.status !== "pending_review") {
    return {
      ok: false,
      message: "This deliverable is not currently awaiting your review.",
    };
  }

  const approvedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("deliverables")
    .update({
      status: "approved",
      approved_at: approvedAt,
      client_feedback: null,
      feedback_at: null,
    })
    .eq("id", deliverableId)
    .eq("status", "pending_review");

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  // Digital sign-off record (append-only ledger).
  const headerList = await headers();
  const forwardedFor =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error: signoffError } = await admin.from("signoffs").insert({
    deliverable_id: deliverableId,
    client_id: client.id,
    workspace_id: client.workspace_id,
    signer_name: signerName,
    signer_email: client.email,
    method: "typed_name",
    ip_address: forwardedFor,
    user_agent: headerList.get("user-agent"),
    notes: parsed.data.note || null,
  });

  if (signoffError) {
    // Roll the approval back so we never approve without an audit record.
    await admin
      .from("deliverables")
      .update({ status: "pending_review", approved_at: null })
      .eq("id", deliverableId);
    return {
      ok: false,
      message: `Could not record your sign-off: ${signoffError.message}`,
    };
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", client.workspace_id)
    .maybeSingle();

  const ownerId = (workspace as Workspace | null)?.owner_id;
  const { data: owner } = ownerId
    ? await admin.auth.admin.getUserById(ownerId)
    : { data: null };

  if (workspace && owner?.user?.email) {
    const mail = approvalEmail({
      workspace: workspace as Workspace,
      client: client as Client,
      deliverable: {
        ...(deliverable as Deliverable),
        approved_at: approvedAt,
      },
      portalUrl: portalUrlFor(accessToken),
    });

    await sendEmail({
      to: owner.user.email,
      subject: mail.subject,
      html: mail.html,
      replyTo: client.email,
      tags: [
        { name: "event", value: "deliverable_approved" },
        { name: "workspace", value: client.workspace_id },
      ],
    });
  }

  revalidatePath(`/portal/${accessToken}`);

  return {
    ok: true,
    message: `Approved. Signed off as ${signerName}. Your agency has been notified.`,
  };
}

const requestChangesSchema = z.object({
  accessToken: tokenParam,
  deliverableId: z.string().uuid(),
  feedback: z
    .string()
    .trim()
    .min(3, "Tell your agency what needs to change")
    .max(4000, "Please keep feedback under 4000 characters"),
});

export async function requestChanges(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestChangesSchema.safeParse({
    accessToken: formData.get("accessToken"),
    deliverableId: formData.get("deliverableId"),
    feedback: formData.get("feedback"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const { accessToken, deliverableId, feedback } = parsed.data;
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("access_token", accessToken)
    .is("revoked_at", null)
    .maybeSingle();

  if (!client) {
    return { ok: false, message: "This portal link is no longer valid." };
  }

  const { data: deliverable } = await admin
    .from("deliverables")
    .select("*")
    .eq("id", deliverableId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!deliverable) {
    return { ok: false, message: "Deliverable not found for this portal." };
  }

  if (deliverable.status === "draft") {
    return { ok: false, message: "This deliverable has not been shared yet." };
  }

  if (deliverable.status === "approved") {
    return {
      ok: false,
      message: "This deliverable is already approved and locked. Contact your agency if something is wrong.",
    };
  }

  const { error } = await admin
    .from("deliverables")
    .update({
      status: "changes_requested",
      client_feedback: feedback,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", deliverableId)
    .eq("client_id", client.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", client.workspace_id)
    .maybeSingle();

  const ownerId = (workspace as Workspace | null)?.owner_id;
  const { data: owner } = ownerId
    ? await admin.auth.admin.getUserById(ownerId)
    : { data: null };

  if (workspace && owner?.user?.email) {
    const mail = revisionRequestEmail({
      workspace: workspace as Workspace,
      client: client as Client,
      deliverable: {
        ...(deliverable as Deliverable),
        client_feedback: feedback,
      },
      portalUrl: portalUrlFor(accessToken),
    });

    await sendEmail({
      to: owner.user.email,
      subject: mail.subject,
      html: mail.html,
      replyTo: client.email,
      tags: [
        { name: "event", value: "changes_requested" },
        { name: "workspace", value: client.workspace_id },
      ],
    });
  }

  revalidatePath(`/portal/${accessToken}`);

  return {
    ok: true,
    message: "Feedback sent. Your agency has been notified.",
  };
}
