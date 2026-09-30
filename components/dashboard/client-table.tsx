"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "@/lib/utils";
import {
  deleteClient,
  rotateAccessToken,
  toggleClientAccess,
} from "@/app/actions/workspace";
import { IDLE, type ActionState } from "@/lib/action-state";

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  project_title: string | null;
  access_token: string;
  revoked_at: string | null;
  created_at: string;
}

export function ClientTable({
  clients,
  appUrl,
}: {
  clients: ClientRow[];
  appUrl: string;
}) {
  const [rows, setRows] = React.useState(clients);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [state, setState] = React.useState<ActionState>(IDLE);

  React.useEffect(() => setRows(clients), [clients]);

  const portalUrlFor = React.useCallback(
    (token: string) => `${appUrl}/portal/${token}`,
    [appUrl],
  );

  async function run(
    clientId: string,
    action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
    extra: Record<string, string> = {},
  ) {
    setBusyId(clientId);
    const fd = new FormData();
    fd.set("clientId", clientId);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);

    const result = await action(state, fd);
    setState(result);
    setBusyId(null);

    if (result.ok) {
      toast.success(result.message ?? "Done");
      // Optimistic local reconcile so the row updates without a full reload.
      if ("revoked_at" in extra) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === clientId
              ? {
                  ...row,
                  revoked_at:
                    extra.revoke === "1" ? null : new Date().toISOString(),
                }
              : row,
          ),
        );
      }
      if (action === deleteClient) {
        setRows((prev) => prev.filter((row) => row.id !== clientId));
      }
    } else if (result.message) {
      toast.error(result.message);
    }
  }

  if (rows.length === 0) {
    return (
      <Alert variant="info">
        <AlertIcon variant="info" />
        <AlertDescription>
          <span className="font-medium">No clients yet.</span> Add your first
          client to mint a magic portal link.{" "}
          <Link
            href="/dashboard/clients/new"
            className="font-medium underline underline-offset-4"
          >
            Add a client
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="hidden lg:table-cell">Magic link</TableHead>
            <TableHead className="hidden md:table-cell">Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((client) => {
            const portalUrl = portalUrlFor(client.access_token);
            const isRevoked = Boolean(client.revoked_at);
            const isBusy = busyId === client.id;

            return (
              <TableRow key={client.id} className={isRevoked ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {client.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {client.email}
                        {client.company ? ` · ${client.company}` : ""}
                      </p>
                    </div>
                    {isRevoked ? (
                      <Badge variant="destructive" className="ml-1">
                        Revoked
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>

                <TableCell className="text-sm text-slate-600">
                  {client.project_title ?? (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  <code className="block max-w-[280px] truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600 ring-1 ring-slate-200">
                    {portalUrl}
                  </code>
                </TableCell>

                <TableCell className="hidden text-sm text-slate-500 md:table-cell">
                  {relativeTime(client.created_at)}
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <CopyButton
                      value={portalUrl}
                      label="Copy Magic Link"
                      iconOnly
                      className="h-9 w-9 p-0"
                      disabled={isRevoked}
                    />

                    <Button asChild size="sm" variant="ghost" className="h-9 px-2.5">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        title="Manage deliverables"
                      >
                        Manage
                      </Link>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isBusy}
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Client actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <a href={portalUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Preview portal
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            navigator.clipboard?.writeText(client.email)
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copy client email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            run(client.id, rotateAccessToken)
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                          Rotate magic link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            run(client.id, toggleClientAccess, {
                              revoke: isRevoked ? "1" : "",
                            })
                          }
                        >
                          {isRevoked ? (
                            <>
                              <Check className="h-4 w-4" />
                              Restore access
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4" />
                              Revoke access
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => run(client.id, deleteClient)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete client
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="text-xs text-slate-500">
        Rotating a link instantly invalidates the previous one. Revoking
        access kills every outstanding link for that client.
      </p>
    </div>
  );
}
