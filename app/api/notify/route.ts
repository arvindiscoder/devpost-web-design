import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { newDeliverableEmail } from "@/lib/email/templates";
import type { Client, Deliverable, Workspace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/notify
 *
 * Optional webhook-style endpoint for "a deliverable was shared with a client".
 * The core approve / request-changes notifications are fired from the server
 * actions in `app/actions/portal.ts` (they are synchronous with the action and
 * carry the sign-off context), this route exists so the dashboard can also
 * trigger a client nudge on demand.
 *
 * Auth: requires a valid Supabase user session cookie OR an `x-cron-secret`
 * header matching `CRON_SECRET`. Never expose this publicly.
 */

const notifySchema = z.object({
  event: z.enum(["deliverable.shared", "deliverable.approved", "deliverable.changes_requested"]),
  deliverableId: z.string().uuid(),
  recipient: z.string().email().optional(),
  portalUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // 1. Cron-style auth header (optional but recommended).
  const headerSecret = request.headers.get("x-cron-secret");
  const hasValidSecret = Boolean(cronSecret) && headerSecret === cronSecret;

  // 2. Or a real Supabase session cookie from the dashboard.
  let hasSession = false;
  let ownerId: string | null = null;

  if (!hasValidSecret) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
    ownerId = user?.id ?? null;
  }

  if (!hasValidSecret && !hasSession) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { deliverableId, event, recipient, portalUrl } = parsed.data;

  const { data: deliverable } = await admin
    .from("deliverables")
    .select("*")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable) {
    return NextResponse.json(
      { ok: false, error: "Deliverable not found" },
      { status: 404 },
    );
  }

  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("id", deliverable.client_id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json(
      { ok: false, error: "Client not found" },
      { status: 404 },
    );
  }

  // Tenant isolation: a session caller must own the workspace.
  if (hasSession && ownerId) {
    const { data: workspace } = await admin
      .from("workspaces")
      .select("owner_id")
      .eq("id", client.workspace_id)
      .maybeSingle();

    if (workspace?.owner_id !== ownerId) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }
  }

  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", client.workspace_id)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found" },
      { status: 404 },
    );
  }

  const resolvedPortalUrl =
    portalUrl ??
    `${env.appUrl}/portal/${(client as Client).access_token}`;

  if (event === "deliverable.shared") {
    const mail = newDeliverableEmail({
      workspace: workspace as Workspace,
      client: client as Client,
      deliverable: deliverable as Deliverable,
      portalUrl: resolvedPortalUrl,
    });

    const result = await sendEmail({
      to: recipient ?? (client as Client).email,
      subject: mail.subject,
      html: mail.html,
      tags: [{ name: "event", value: "deliverable_shared" }],
    });

    return NextResponse.json(
      { ok: true, event, delivery: result },
      { status: result.sent ? 200 : 202 },
    );
  }

  // approve / request-changes are already handled inside the server actions so
  // the sign-off ledger and the email stay in the same transaction boundary.
  return NextResponse.json(
    {
      ok: true,
      event,
      delivery: {
        sent: false,
        reason: `Event '${event}' is emitted by the server action, not this route.`,
      },
    },
    { status: 202 },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "clientsync-notify",
    events: [
      "deliverable.shared",
      "deliverable.approved",
      "deliverable.changes_requested",
    ],
    auth: "Supabase session cookie or x-cron-secret header",
  });
}
