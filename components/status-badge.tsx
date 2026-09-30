import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";
import type { DeliverableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: DeliverableStatus;
  className?: string;
  showDot?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge className={cn(meta.badge, className)}>
      {showDot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      ) : null}
      {meta.label}
    </Badge>
  );
}
