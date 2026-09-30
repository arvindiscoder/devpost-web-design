import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  Settings,
  UserPlus,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Wordmark />
          {workspace ? (
            <span className="truncate rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {workspace.name}
            </span>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FolderKanban className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/clients/new"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <UserPlus className="h-4 w-4" />
            Add client
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>

        <div className="space-y-3 border-t border-slate-200 px-5 py-5 text-sm">
          {workspace ? (
            <div className="rounded-lg bg-indigo-50/70 p-3 text-indigo-900 ring-1 ring-indigo-200/70">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <p className="font-medium">Free forever</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-indigo-800/80">
                {workspace.name} is on the $0 plan. You can onboard up to 5
                active clients.
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <form action="/auth/logout" method="post" className="flex-1">
              <Button type="submit" variant="outline" className="w-full">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col pl-72">
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white/70 px-8 py-4 text-center text-xs text-slate-500">
          ClientSync · $0 infrastructure · built for freelancers and agencies
        </footer>
      </div>
    </div>
  );
}
