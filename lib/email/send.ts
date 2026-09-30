import "server-only";

import { Resend } from "resend";

import { env, isResendConfigured } from "@/lib/env";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!cached) cached = new Resend(env.resendApiKey);
  return cached;
}

export interface NotifyResult {
  sent: boolean;
  reason?: string;
  id?: string;
}

/**
 * Fire-and-forget transactional email.
 *
 * Notification delivery must NEVER block or fail the user's core action: if
 * Resend is down, rate-limited, or unconfigured, the approval itself still
 * succeeds. We log and swallow.
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  tags,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<NotifyResult> {
  const resend = getResend();

  if (!resend) {
    return {
      sent: false,
      reason:
        "RESEND_API_KEY is not configured — notification skipped (the action still succeeded).",
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(tags ? { tags } : {}),
    });

    if (error) {
      return { sent: false, reason: error.message };
    }

    return { sent: true, id: data?.id };
  } catch (caught) {
    return {
      sent: false,
      reason: caught instanceof Error ? caught.message : "Unknown Resend error",
    };
  }
}
