import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceSettingsForm } from "@/components/dashboard/workspace-settings-form";
import { NewWorkspaceModal } from "@/components/dashboard/new-workspace-modal";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
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

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <Card className="border-dashed border-indigo-300 bg-indigo-50/60">
          <CardHeader>
            <CardTitle>No workspace yet</CardTitle>
            <CardDescription>
              Create one to unlock branding settings and client management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewWorkspaceModal trigger={<Button>Create workspace</Button>} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientCount =
    (
      await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
    ).count ?? 0;

  const signoffCount =
    (
      await supabase
        .from("signoffs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
    ).count ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-slate-600">
          Branding shown on every client portal under {workspace.name}.
        </p>
      </div>

      <Alert variant="info">
        <AlertIcon variant="info" />
        <AlertDescription>
          You are signed in as{" "}
          <span className="font-medium">{user.email}</span> · plan{" "}
          <span className="font-medium uppercase">{workspace.plan}</span> ·
          trial ends {formatDate(workspace.trial_ends_at)} ·{" "}
          {clientCount} client{clientCount === 1 ? "" : "s"} · {signoffCount}{" "}
          sign-off{signoffCount === 1 ? "" : "s"}
        </AlertDescription>
      </Alert>

      <WorkspaceSettingsForm
        workspace={{
          id: workspace.id,
          name: workspace.name,
          accent_color: workspace.accent_color,
          logo_url: workspace.logo_url,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Session and identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-600">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-600">User ID</span>
            <code className="font-mono text-xs text-slate-500">{user.id}</code>
          </div>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
