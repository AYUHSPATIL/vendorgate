import type { Decision, StageStatus } from "../lib/types.ts"
import { cn } from "../lib/utils.ts"

const DECISION_STYLES: Record<Decision, string> = {
  APPROVED: "bg-green-100 text-green-800 ring-green-200",
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  REJECTED: "bg-red-100 text-red-800 ring-red-200",
  RUNNING: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  FAILED: "bg-red-100 text-red-800 ring-red-200",
}

const DECISION_LABELS: Record<Decision, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Rejected",
  RUNNING: "Running",
  FAILED: "Failed",
}

export function StatusBadge({ decision, className }: { decision: Decision; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        DECISION_STYLES[decision],
        className,
      )}
    >
      {DECISION_LABELS[decision]}
    </span>
  )
}

export function stageStatusLabel(status: StageStatus): string {
  switch (status) {
    case "pass":
      return "Passed"
    case "warn":
      return "Warning"
    case "fail":
      return "Failed"
    case "running":
      return "Running"
    default:
      return "Waiting"
  }
}
