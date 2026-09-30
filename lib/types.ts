/**
 * Shared database types, mirrored from `supabase/migrations/0001_init.sql`.
 * Regenerate with: npx supabase gen types typescript --project-id <ref> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DeliverableStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "approved";

export type WorkspacePlan = "free" | "pro" | "agency";
export type SignoffMethod = "typed_name" | "checkbox" | "initials";

export interface Workspace {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  owner_id: string;
  logo_url: string | null;
  accent_color: string | null;
  plan: WorkspacePlan;
  trial_ends_at: string | null;
}

export interface Client {
  id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  name: string;
  email: string;
  company: string | null;
  project_title: string | null;
  access_token: string;
  revoked_at: string | null;
  last_seen_at: string | null;
}

export interface Deliverable {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  status: DeliverableStatus;
  client_feedback: string | null;
  feedback_at: string | null;
  revision: number;
  due_date: string | null;
  approved_at: string | null;
}

export interface Signoff {
  id: string;
  created_at: string;
  deliverable_id: string;
  client_id: string;
  workspace_id: string;
  signer_name: string;
  signer_email: string;
  method: SignoffMethod;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
}

/** Shape the dashboard/portal pages hydrate into the client components. */
export interface DeliverableWithSignoff extends Deliverable {
  signoffs?: Signoff[];
}

export interface ClientWithWorkspace extends Client {
  workspace: Workspace;
  deliverable_count?: number;
  pending_count?: number;
  approved_count?: number;
}

export interface PortalPayload {
  client: Client;
  workspace: Workspace;
  deliverables: DeliverableWithSignoff[];
}

export const DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
];
