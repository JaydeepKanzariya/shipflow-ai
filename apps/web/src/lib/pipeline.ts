/**
 * The delivery pipeline — the product's core identity. Every FeatureStatus
 * maps to one of seven visual stages; each stage owns a colour so status
 * encodes position in the loop. Consumed by the PipelineRail and StatusBadge.
 */

export type Stage = {
  key: string;
  label: string;
  /** CSS custom property for this stage's colour. */
  colorVar: string;
  statuses: string[];
};

export const STAGES: Stage[] = [
  { key: "discovery", label: "Discovery", colorVar: "--stage-discovery", statuses: ["DISCOVERY", "CLARIFYING"] },
  { key: "prd", label: "PRD", colorVar: "--stage-prd", statuses: ["PRD_DRAFT", "PRD_APPROVED"] },
  { key: "tasks", label: "Tasks", colorVar: "--stage-tasks", statuses: ["TASKS_READY"] },
  { key: "dev", label: "Development", colorVar: "--stage-dev", statuses: ["IN_DEVELOPMENT"] },
  { key: "review", label: "AI review", colorVar: "--stage-review", statuses: ["IN_AI_REVIEW", "FIX_NEEDED"] },
  { key: "approval", label: "Approval", colorVar: "--stage-approved", statuses: ["READY_FOR_APPROVAL", "APPROVED"] },
  { key: "shipped", label: "Shipped", colorVar: "--stage-shipped", statuses: ["SHIPPED"] },
];

/** Index of the stage a status belongs to (-1 for off-pipeline, e.g. REJECTED). */
export function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.statuses.includes(status));
}

/** Per-status display metadata: human label, stage colour, alert flag. */
export const STATUS_META: Record<
  string,
  { label: string; colorVar: string; alert?: boolean }
> = {
  DISCOVERY: { label: "Discovery", colorVar: "--stage-discovery" },
  CLARIFYING: { label: "Needs answers", colorVar: "--stage-review", alert: true },
  REJECTED: { label: "Not building", colorVar: "--destructive", alert: true },
  PRD_DRAFT: { label: "PRD draft", colorVar: "--stage-prd" },
  PRD_APPROVED: { label: "PRD approved", colorVar: "--stage-prd" },
  TASKS_READY: { label: "Tasks ready", colorVar: "--stage-tasks" },
  IN_DEVELOPMENT: { label: "In development", colorVar: "--stage-dev" },
  IN_AI_REVIEW: { label: "AI review", colorVar: "--stage-review" },
  FIX_NEEDED: { label: "Fix needed", colorVar: "--stage-fix", alert: true },
  READY_FOR_APPROVAL: { label: "Ready for approval", colorVar: "--stage-approved" },
  APPROVED: { label: "Approved", colorVar: "--stage-approved" },
  SHIPPED: { label: "Shipped", colorVar: "--stage-shipped" },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? { label: status, colorVar: "--muted-foreground" }
  );
}
