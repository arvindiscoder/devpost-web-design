"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Copies a magic link to the clipboard. Falls back to a hidden <textarea> +
 * execCommand for browsers that block the async Clipboard API over plain HTTP.
 */
export function CopyButton({
  value,
  label = "Copy Magic Link",
  copiedLabel = "Copied",
  className,
  variant = "outline",
  size = "sm",
  iconOnly = false,
  onCopied,
  ...props
}: ButtonProps & {
  value: string;
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      toast.success("Magic link copied", {
        description: "Send it to your client — no login required.",
      });
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically", {
        description: value,
      });
    }
  }

  return (
    <Button
      type="button"
      onClick={copy}
      variant={variant}
      size={size}
      className={cn(className)}
      {...props}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {iconOnly ? (
        <span className="sr-only">{copied ? copiedLabel : label}</span>
      ) : (
        <span>{copied ? copiedLabel : label}</span>
      )}
    </Button>
  );
}
