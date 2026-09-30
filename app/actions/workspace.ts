"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { BUCKET_NAME } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as getSupabase } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Resolves the caller's first workspace, or null when unauthenticated. */
export async function getSessionContext() {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { supabase, user, workspace: workspace ?? null };
}

const name = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(200);

/* -------------------------------------------------------------------------- */
/*  Workspaces                                                                  */
/* -------------------------------------------------------------------------- */

const workspaceSchema = z.object({
  name: name(2, 80, "Workspace name"),
});

export async function createWorkspace(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const context = await getSessionContext();
  if (!context) return { ok: false, message: "Your session expired. Sign in again." };

  if (context.workspace) {
    return {
      ok: false,
      message: "You already have a workspace. Free plan supports one per account.",
    };
  }

  const { error } = await context.supabase
    .from("workspaces")
    .insert({
      name: parsed.data.name,
      owner_id: context.user.id,
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true, message: "Workspace created." };
}

const brandingSchema = z.object({
  workspaceId: z.string().uuid(),
  name: name(2, 80, "Workspace name"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4f46e5")
    .optional(),
  logoUrl: z
    .union([z.literal(""), z.string().url("Enter a valid URL"), z.string().max(500)])
    .optional(),
});

export async function updateWorkspaceBranding(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = brandingSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    accentColor: formData.get("accentColor") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const context = await getSessionContext();
  if (!context?.workspace) {
    return { ok: false, message: "Session expired. Sign in again." };
  }
  if (context.workspace.id !== parsed.data.workspaceId) {
    return { ok: false, message: "You can only edit your own workspace." };
  }

  const { error } = await context.supabase
    .from("workspaces")
    .update({
      name: parsed.data.name,
      accent_color: parsed.data.accentColor ?? null,
      logo_url: parsed.data.logoUrl ? parsed.data.logoUrl : null,
    })
    .eq("id", parsed.data.workspaceId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings", "layout");
  return { ok: true, message: "Branding updated." };
}

/* -------------------------------------------------------------------------- */
/*  Clients                                                                     */
/* -------------------------------------------------------------------------- */

const clientSchema = z.object({
  workspaceId: z.string().uuid(),
  name: name(1, 120, "Client name"),
  email: emailField,
  company: name(0, 120, "Company").optional().or(z.literal("")),
  projectTitle: name(0, 160, "Project title").optional().or(z.literal("")),
});

export async function createClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = clientSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    projectTitle: formData.get("projectTitle") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message };
  }

  const context = await getSessionContext();
  if (!context?.workspace) {
    return { ok: false, message: "Create a workspace before adding clients." };
  }
  if (context.workspace.id !== parsed.data.workspaceId) {
    return { ok: false, message: "You can only add clients to your own workspace." };
  }

  // Free-tier cap: 5 active clients per workspace.
  const { count } = await context.supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", parsed.data.workspaceId)
    .is("revoked_at", null);

  if ((count ?? 0) >= 5) {
    return {
      ok: false,
      message:
        "The free plan includes 5 active clients. Revoke a client to make room.",
    };
  }

  const { data, error } = await context.supabase
    .from("clients")
    .insert({
      workspace_id: parsed.data.workspaceId,
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      project_title: parsed.data.projectTitle || null,
    })
    .select("id, access_token")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `${parsed.data.name} added. Magic link is ready to copy.`,
    fieldErrors: { newClientId: data?.id ?? "", newClientToken: data?.access_token ?? "" },
  };
}

const revokeSchema = z.object({
  clientId: z.string().uuid(),
  revoke: z.string().optional(),
});

export async function toggleClientAccess(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = revokeSchema.safeParse({
    clientId: formData.get("clientId"),
    revoke: formData.get("revoke"),
  });

  if (!parsed.success) return { ok: false, message: "Invalid client." };

  const context = await getSessionContext();
  if (!context) return { ok: false, message: "Session expired." };

  const { data: client } = await context.supabase
    .from("clients")
    .select("id, name, revoked_at")
    .eq("id", parsed.data.clientId)
    .maybeSingle();

  if (!client) return { ok: false, message: "Client not found." };

  // RLS guarantees ownership; this is a defence-in-depth re-check.
  const { data: owned } = await context.supabase
    .from("workspaces")
    .select("id")
    .eq("id", context.workspace?.id ?? "")
    .maybeSingle();

  if (!owned) return { ok: false, message: "Not your client." };

  const nextRevoked = parsed.data.revoke === "1" ? null : new Date().toISOString();

  const { error } = await context.supabase
    .from("clients")
    .update({ revoked_at: nextRevoked })
    .eq("id", parsed.data.clientId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: nextRevoked
      ? `Portal link revoked for ${client.name}.`
      : `Portal link restored for ${client.name}.`,
  };
}

export async function rotateAccessToken(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const clientId = z.string().uuid().safeParse(formData.get("clientId"));
  if (!clientId.success) return { ok: false, message: "Invalid client." };

  const context = await getSessionContext();
  if (!context) return { ok: false, message: "Session expired." };

  const { data, error } = await context.supabase
    .from("clients")
    .update({ access_token: crypto.randomUUID() })
    .eq("id", clientId.data)
    .select("access_token")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Client not found." };

  revalidatePath("/dashboard");
  return { ok: true, message: "Magic link rotated. The old link is now dead." };
}

export async function deleteClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("clientId"));
  if (!parsed.success) return { ok: false, message: "Invalid client." };

  const context = await getSessionContext();
  if (!context) return { ok: false, message: "Session expired." };

  // Collect storage objects first so we can clean the bucket up.
  const { data: files } = await context.supabase
    .from("deliverables")
    .select("file_path")
    .eq("client_id", parsed.data);

  const paths = (files ?? [])
    .map((row) => row.file_path)
    .filter((path): path is string => Boolean(path));

  const { error } = await context.supabase
    .from("clients")
    .delete()
    .eq("id", parsed.data);

  if (error) return { ok: false, message: error.message };

  if (paths.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET_NAME).remove(paths);
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Client and all deliverables deleted." };
}

export async function openClientPortal(clientId: string): Promise<void> {
  redirect(`/dashboard/clients/${clientId}`);
}
