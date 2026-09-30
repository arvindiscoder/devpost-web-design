/**
 * Status presentation map — single source of truth for badges + copy.
 */
import type { DeliverableStatus } from "@/lib/types";

export interface StatusMeta {
  label: string;
  short: string;
  badge: string;
  dot: string;
  description: string;
  /** What the client is allowed to do right now. */
  clientCanAct: boolean;
  cta: string;
}

export const STATUS_META: Record<DeliverableStatus, StatusMeta> = {
  draft: {
    label: "Draft",
    short: "Draft",
    badge:
      "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
    description: "Only your team can see this. Share it when it is ready.",
    clientCanAct: false,
    cta: "Not shared yet",
  },
  pending_review: {
    label: "Pending Review",
    short: "Pending",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
    description: "Waiting on the client to approve or request changes.",
    clientCanAct: true,
    cta: "Awaiting decision",
  },
  changes_requested: {
    label: "Changes Requested",
    short: "Changes",
    badge:
      "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    dot: "bg-rose-500",
    description: "The client asked for revisions. Resubmit when it is updated.",
    clientCanAct: false,
    cta: "Revision requested",
  },
  approved: {
    label: "Approved",
    short: "Approved",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    dot: "bg-emerald-500",
    description: "Signed off by the client. Locked for the audit trail.",
    clientCanAct: false,
    cta: "Signed off",
  },
};

export const STATUS_OPTIONS = (
  Object.keys(STATUS_META) as DeliverableStatus[]
).map((value) => ({ value, label: STATUS_META[value].label }));
