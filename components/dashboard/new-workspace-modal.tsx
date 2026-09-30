"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { createWorkspace } from "@/app/actions/workspace";
import { IDLE, type ActionState } from "@/lib/action-state";

export function NewWorkspaceModal({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<ActionState>(IDLE);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    const result = await createWorkspace(state, formData);
    setState(result);
    if (result.ok) {
      toast.success(result.message ?? "Workspace created");
      formRef.current?.reset();
      setOpen(false);
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={onSubmit} ref={formRef} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create your workspace</DialogTitle>
            <DialogDescription>
              This is the home for your clients and deliverables. You can
              rename it later in Settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              name="name"
              placeholder="Acme Studio"
              required
              minLength={2}
              maxLength={80}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create workspace</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
