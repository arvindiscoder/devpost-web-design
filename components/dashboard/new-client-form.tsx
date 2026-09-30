"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Link2, Sparkles } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { createClient } from "@/app/actions/workspace";
import { IDLE, type ActionState } from "@/lib/action-state";

export function NewClientForm({
  workspaceId,
  activeClients,
}: {
  workspaceId: string;
  activeClients: number;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, setState] = React.useState<ActionState>(IDLE);
  const [created, setCreated] = React.useState<{
    name: string;
    url: string;
  } | null>(null);

  async function onSubmit(formData: FormData) {
    const result = await createClient(state, formData);
    setState(result);

    if (result.ok) {
      const token = result.fieldErrors?.newClientToken;
      const clientId = result.fieldErrors?.newClientId;
      const name = String(formData.get("name") ?? "Client");

      if (token) {
        setCreated({ name, url: `${env.appUrl}/portal/${token}` });
        toast.success(`${name} added`, {
          description: "Their magic link is ready to share.",
        });
        formRef.current?.reset();
        if (clientId) router.refresh();
      } else {
        toast.success(result.message ?? "Client created");
        router.refresh();
      }
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  const atLimit = activeClients >= 5;

  if (created) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>{created.name} is ready to go</CardTitle>
          <CardDescription>
            Send them this link. No account, no password — it just works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-700">
              {created.url}
            </code>
            <CopyButton value={created.url} className="shrink-0" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreated(null)}
            >
              Add another client
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client details</CardTitle>
        <CardDescription>
          We&apos;ll generate a unique access token and build the portal URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={onSubmit} className="space-y-5">
          <input type="hidden" name="workspaceId" value={workspaceId} />

          {atLimit ? (
            <Alert variant="warning">
              <AlertIcon variant="warning" />
              <AlertDescription>
                The free plan allows 5 active clients and you currently have{" "}
                {activeClients}. Revoke a client from the dashboard to make
                room.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.message && !state.ok ? (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Client name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Jordan Rivera"
                autoComplete="name"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jordan@company.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company (optional)</Label>
              <Input
                id="company"
                name="company"
                placeholder="Rivera Coffee Co."
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectTitle">Project title (optional)</Label>
              <Input
                id="projectTitle"
                name="projectTitle"
                placeholder="Brand refresh"
                maxLength={160}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              pendingText="Creating…"
              disabled={atLimit}
              disabled-title={atLimit ? "Free plan client limit reached" : undefined}
            >
              <Sparkles className="h-4 w-4" />
              Create client &amp; magic link
            </SubmitButton>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              Generates a uuid v4 access token
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
