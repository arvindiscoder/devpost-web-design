import type { Client, Deliverable, Workspace } from "@/lib/types";
import { STATUS_META } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Inline email shell (table-based, inline CSS — email-client safe)           */
/* -------------------------------------------------------------------------- */

function shell({
  accent,
  heading,
  preheader,
  bodyHtml,
  ctaLabel,
  ctaHref,
  footer,
}: {
  accent: string;
  heading: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer: string;
}) {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0; padding:0; background:#f1f5f9; -webkit-font-smoothing:antialiased; }
    table { border-collapse:collapse; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; }
      .px { padding-left:20px !important; padding-right:20px !important; }
      .stack { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">

          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td class="px" style="padding:28px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:16px;font-weight:700;letter-spacing:-.01em;color:#0f172a;">
                    ${workspaceName(accent)}
                  </td>
                  <td align="right" style="font-size:12px;color:#94a3b8;">ClientSync</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:16px 32px 0 32px;">
              <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-.02em;color:#0f172a;">${heading}</h1>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:0 32px 24px 32px;font-size:15px;line-height:1.65;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>

          ${
            ctaLabel && ctaHref
              ? `<tr>
                  <td class="px" style="padding:0 32px 28px 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:10px;background:${accent};">
                          <a href="${ctaHref}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${ctaLabel}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
              : ""
          }

          <tr>
            <td class="px" style="padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
              ${footer}
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px;max-width:600px;">
          <tr>
            <td align="center" style="padding-top:20px;font-size:11px;line-height:1.6;color:#94a3b8;">
              Sent by ClientSync · zero-cost client approvals<br />
              <span style="color:#cbd5e1;">This is an automated notification. Reply directly to this email to reach your agency.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function workspaceName(accent: string) {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${accent};vertical-align:middle;margin-right:8px;"></span>ClientSync`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* -------------------------------------------------------------------------- */
/*  1. Client approved a deliverable  ->  notify the agency owner               */
/* -------------------------------------------------------------------------- */

export function approvalEmail({
  workspace,
  client,
  deliverable,
  portalUrl,
}: {
  workspace: Workspace;
  client: Client;
  deliverable: Deliverable;
  portalUrl: string;
}) {
  const accent = workspace.accent_color ?? "#4f46e5";
  const body = `
    <p style="margin:0 0 16px 0;">
      <strong style="color:#0f172a;">${escapeHtml(client.name)}</strong> has approved
      <strong style="color:#0f172a;">${escapeHtml(deliverable.title)}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px 0;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;line-height:1.8;color:#334155;">
          <div><span style="color:#64748b;">Client</span> · ${escapeHtml(client.name)}${
            client.company ? ` (${escapeHtml(client.company)})` : ""
          }</div>
          <div><span style="color:#64748b;">Email</span> · ${escapeHtml(client.email)}</div>
          <div><span style="color:#64748b;">Revision</span> · v${deliverable.revision}</div>
          <div><span style="color:#64748b;">Signed off</span> · ${formatDateTime(deliverable.approved_at)}</div>
          <div><span style="color:#64748b;">Status</span> · <span style="color:#059669;font-weight:600;">${STATUS_META.approved.label}</span></div>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#64748b;font-size:13px;">
      The sign-off is recorded in your audit trail and cannot be edited by the client.
    </p>`;

  return {
    subject: `✅ ${client.name} approved “${deliverable.title}”`,
    html: shell({
      accent,
      heading: "Deliverable approved",
      preheader: `${client.name} signed off on ${deliverable.title}`,
      bodyHtml: body,
      footer: `${escapeHtml(workspace.name)} · Client approval notification · <a href="${portalUrl}" style="color:#6366f1;text-decoration:underline;">View client portal</a>`,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  2. Client requested changes  ->  notify the agency owner                   */
/* -------------------------------------------------------------------------- */

export function revisionRequestEmail({
  workspace,
  client,
  deliverable,
  portalUrl,
}: {
  workspace: Workspace;
  client: Client;
  deliverable: Deliverable;
  portalUrl: string;
}) {
  const accent = workspace.accent_color ?? "#4f46e5";
  const feedback = deliverable.client_feedback?.trim();

  const body = `
    <p style="margin:0 0 16px 0;">
      <strong style="color:#0f172a;">${escapeHtml(client.name)}</strong> requested changes to
      <strong style="color:#0f172a;">${escapeHtml(deliverable.title)}</strong>.
    </p>
    ${
      feedback
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-left:3px solid #f97316;border-radius:8px;margin:0 0 16px 0;">
             <tr>
               <td style="padding:14px 16px;font-size:14px;line-height:1.7;color:#7c2d12;font-style:italic;">
                 ${escapeHtml(feedback).replace(/\n/g, "<br />")}
               </td>
             </tr>
           </table>`
        : `<p style="margin:0 0 16px 0;color:#64748b;">No written feedback was provided.</p>`
    }
    <p style="margin:0;color:#64748b;font-size:13px;">
      Upload a new version and hit <strong>Resubmit for review</strong> to send it straight back to ${escapeHtml(client.name)}.
    </p>`;

  return {
    subject: `🛠 ${client.name} requested changes to “${deliverable.title}”`,
    html: shell({
      accent,
      heading: "Changes requested",
      preheader: feedback
        ? `${client.name}: ${feedback.slice(0, 120)}`
        : `${client.name} requested changes`,
      bodyHtml: body,
      footer: `${escapeHtml(workspace.name)} · Revision request notification · <a href="${portalUrl}" style="color:#6366f1;text-decoration:underline;">View client portal</a>`,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  3. New deliverable shared  ->  nudge the client                            */
/* -------------------------------------------------------------------------- */

export function newDeliverableEmail({
  workspace,
  client,
  deliverable,
  portalUrl,
}: {
  workspace: Workspace;
  client: Client;
  deliverable: Deliverable;
  portalUrl: string;
}) {
  const accent = workspace.accent_color ?? "#4f46e5";
  const body = `
    <p style="margin:0 0 16px 0;">
      ${escapeHtml(workspace.name)} has shared a new deliverable for your review.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px 0;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;line-height:1.8;color:#334155;">
          <div style="font-weight:600;color:#0f172a;font-size:15px;">${escapeHtml(deliverable.title)}</div>
          ${
            deliverable.description
              ? `<div style="margin-top:6px;color:#475569;">${escapeHtml(deliverable.description).slice(0, 400)}</div>`
              : ""
          }
          ${
            deliverable.due_date
              ? `<div style="margin-top:8px;color:#64748b;">Requested by ${formatDateTime(deliverable.due_date)}</div>`
              : ""
          }
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#64748b;font-size:13px;">
      Reviewing takes two clicks — no account, no password, no download limits.
    </p>`;

  return {
    subject: `📦 New deliverable for review: ${deliverable.title}`,
    html: shell({
      accent,
      heading: "A new deliverable is ready",
      preheader: `${workspace.name} shared "${deliverable.title}" with ${client.name}`,
      bodyHtml: body,
      ctaLabel: "Review deliverable",
      ctaHref: portalUrl,
      footer: `Sent on behalf of ${escapeHtml(workspace.name)} · You received this because you are a client on this portal.`,
    }),
  };
}
