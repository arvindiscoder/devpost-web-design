import { redirect } from "next/navigation";
import {
  ArrowRight,
  FileCheck2,
  FolderKanban,
  Inbox,
  Plus,
  Users,
} from "lucide-react";

import { ClientTable } from "@/components/dashboard/client-table";
import { NewWorkspaceModal } from "@/components/dashboard/new-workspace-modal";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  type ClientRow = {
    id: string;
    name: string;
    email: string;
    company: string | null;
    project_title: string | null;
    access_token: string;
    revoked_at: string | null;
    created_at: string;
  };

  const clients: ClientRow[] = workspace
    ? (
        await supabase
          .from("clients")
          .select(
            "id, name, email, company, project_title, access_token, revoked_at, created_at",
          )
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  const allClientIds = clients.map((c) => c.id);
  let pendingCount = 0;
  let approvedCount = 0;
  let deliverableCount = 0;

  if (allClientIds.length) {
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("id, status, client_id")
      .in("client_id", allClientIds);

    deliverableCount = deliverables?.length ?? 0;
    pendingCount =
      deliverables?.filter((d) => d.status === "pending_review").length ?? 0;
    approvedCount =
      deliverables?.filter((d) => d.status === "approved").length ?? 0;
  }

  const activeClients = clients.filter((c) => !c.revoked_at).length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-balance text-slate-600">
            Share deliverables, collect approvals and track feedback — all with
            zero infrastructure cost.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {activeClients} active client{activeClients === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            {pendingCount} pending review
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <FileCheck2 className="h-3.5 w-3.5" />
            {approvedCount} approved
          </Badge>
          <Button asChild size="sm">
            <a href="/dashboard/clients/new">
              <Plus className="h-4 w-4" />
              New client
            </a>
          </Button>
        </div>
      </header>

      {!workspace ? (
        <Card className="border-dashed border-indigo-300 bg-indigo-50/60">
          <CardHeader>
            <CardTitle>Create your first workspace</CardTitle>
            <CardDescription>
              A workspace isolates your clients and deliverables. It takes less
              than a minute to set up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewWorkspaceModal trigger={<Button>Get started</Button>} />
          </CardContent>
        </Card>
      ) : null}

      {workspace ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Active clients"
              value={activeClients}
              description="Free tier allows 5 active clients"
              icon={Users}
            />
            <StatCard
              title="Pending review"
              value={pendingCount}
              description="Waiting for a client decision"
              icon={Inbox}
            />
            <StatCard
              title="Approved"
              value={approvedCount}
              description="Signed off with timestamp"
              icon={FileCheck2}
            />
            <StatCard
              title="Total deliverables"
              value={deliverableCount}
              description="Across all active clients"
              icon={FolderKanban}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>
                  Copy a magic link to invite your client. No account required.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                  Magic link: {env.appUrl}/portal/[access_token]
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ClientTable
                clients={clients}
                appUrl={env.appUrl}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How this works</CardTitle>
              <CardDescription>
                The fastest way to get your first approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                {[
                  "1. Add a client → ClientSync mints a magic link.",
                  "2. Upload a deliverable and share it.",
                  "3. Client approves or requests changes in two clicks.",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
                    {line}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
