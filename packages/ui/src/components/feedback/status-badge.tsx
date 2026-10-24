import { cn } from "@bahayplus/ui/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-info-soft text-info",
  brand: "bg-sage text-sage-foreground",
};

/**
 * Known statuses across modules → tone. Unknown statuses fall back to neutral,
 * so a new backend status never crashes the UI.
 */
const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  paid: "success",
  completed: "success",
  confirmed: "success",
  approved: "success",
  verified: "success",
  accepted: "success",
  delivered: "success",
  pending: "warning",
  suspended: "warning",
  unpaid: "warning",
  partially_paid: "warning",
  submitted: "info",
  under_review: "info",
  in_progress: "info",
  scheduled: "info",
  draft: "neutral",
  archived: "neutral",
  inactive: "neutral",
  expired: "neutral",
  cancelled: "neutral",
  overdue: "danger",
  rejected: "danger",
  revoked: "danger",
  failed: "danger",
  disputed: "danger",
};

export function humanizeStatus(status: string): string {
  const text = status.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type StatusBadgeProps = {
  status: string;
  label?: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? STATUS_TONE[status] ?? "neutral";
  return (
    <span
      data-status={status}
      data-tone={resolved}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASS[resolved],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? humanizeStatus(status)}
    </span>
  );
}
