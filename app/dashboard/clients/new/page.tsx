import { redirect } from "next/navigation";
import { ArrowLeft, Copy, Eye, UserPlus } from "lucide-react";

import { NewClientForm } from "@/components/dashboard/new-client-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { NewWorkspaceModal } from "@/components/dashboard/new-workspace-modal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add client" };

export default async function NewClientPage() {
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
        <Button asChild variant="ghost" className="gap-2">
          <a href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </a>
        </Button>
        <Card className="border-dashed border-indigo-300 bg-indigo-50/60">
          <CardHeader>
            <CardTitle>Create a workspace first</CardTitle>
            <CardDescription>
              Clients always live inside a workspace. Create one, then add your
              client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewWorkspaceModal trigger={<Button>Create workspace</Button>} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .is("revoked_at", null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" className="gap-2 -ml-2">
        <a href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </a>
      </Button>

      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-slate-900">
          <UserPlus className="h-7 w-7 text-indigo-600" />
          Add a client
        </h1>
        <p className="mt-1 text-balance text-slate-600">
          A name and an email is all you need. ClientSync generates a unique
          magic link you can send to {workspace.name}&apos;s client — they never
          create an account.
        </p>
      </div>

      <NewClientForm workspaceId={workspace.id} activeClients={count ?? 0} />

      <Card className="border-slate-200 bg-slate-50/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-slate-500" />
            How sharing works
          </CardTitle>
          <CardDescription>Three facts worth knowing.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              The client opens <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs ring-1 ring-slate-200">/portal/&lt;access_token&gt;</code>{" "}
              and sees only their own deliverables.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Drafts are invisible to clients until you explicitly share them.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Approvals and revision requests land in your dashboard and your
              inbox within a second.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
