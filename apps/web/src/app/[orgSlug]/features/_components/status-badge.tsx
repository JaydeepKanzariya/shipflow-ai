import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  DISCOVERY: { label: "Discovery", variant: "muted" },
  CLARIFYING: { label: "Needs answers", variant: "warning" },
  REJECTED: { label: "Not building", variant: "destructive" },
  PRD_DRAFT: { label: "PRD draft", variant: "default" },
  PRD_APPROVED: { label: "PRD approved", variant: "success" },
  TASKS_READY: { label: "Tasks ready", variant: "default" },
  IN_DEVELOPMENT: { label: "In development", variant: "default" },
  IN_AI_REVIEW: { label: "AI review", variant: "default" },
  FIX_NEEDED: { label: "Fix needed", variant: "warning" },
  READY_FOR_APPROVAL: { label: "Ready for approval", variant: "default" },
  APPROVED: { label: "Approved", variant: "success" },
  SHIPPED: { label: "Shipped", variant: "success" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
