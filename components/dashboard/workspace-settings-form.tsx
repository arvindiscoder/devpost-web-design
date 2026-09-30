"use client";

import * as React from "react";
import { toast } from "sonner";
import { Palette } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateWorkspaceBranding } from "@/app/actions/workspace";
import { IDLE, type ActionState } from "@/lib/action-state";

const PRESETS = [
  "#4f46e5", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#7c3aed", // violet
  "#0f172a", // slate
];

export function WorkspaceSettingsForm({
  workspace,
}: {
  workspace: {
    id: string;
    name: string;
    accent_color: string | null;
    logo_url: string | null;
  };
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, setState] = React.useState<ActionState>(IDLE);
  const [accent, setAccent] = React.useState(
    workspace.accent_color ?? "#4f46e5",
  );

  async function onSubmit(formData: FormData) {
    const result = await updateWorkspaceBranding(state, formData);
    setState(result);
    if (result.ok) toast.success(result.message ?? "Branding updated");
    else if (result.message) toast.error(result.message);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Portal branding
        </CardTitle>
        <CardDescription>
          The accent colour is applied to buttons, links and the email header
          your client receives.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={onSubmit} className="space-y-5">
          <input type="hidden" name="workspaceId" value={workspace.id} />

          {state.message && !state.ok ? (
            <Alert variant="destructive">
              <AlertIcon variant="destructive" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.ok ? (
            <Alert variant="success">
              <AlertIcon variant="success" />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                name="name"
                defaultValue={workspace.name}
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={workspace.logo_url ?? ""}
                placeholder="https://…/logo.png"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accentColor">Accent colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Use ${preset}`}
                  onClick={() => setAccent(preset)}
                  style={{ backgroundColor: preset }}
                  className={`h-8 w-8 rounded-lg ring-offset-2 transition-all ${
                    accent.toLowerCase() === preset
                      ? "ring-2 ring-slate-900 scale-110"
                      : "ring-1 ring-slate-200 hover:scale-105"
                  }`}
                />
              ))}
              <Input
                id="accentColor"
                name="accentColor"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="h-10 w-32 font-mono text-xs"
                pattern="#[0-9a-fA-F]{6}"
              />
              <span
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
                style={{ backgroundColor: accent }}
              >
                Preview
              </span>
            </div>
          </div>

          <SubmitButton variant="outline" pendingText="Saving…">
            Save branding
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
