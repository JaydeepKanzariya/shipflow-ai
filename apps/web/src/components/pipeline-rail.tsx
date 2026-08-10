import { Check } from "lucide-react";
import { STAGES, stageIndex } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/**
 * The signature element: the delivery pipeline. Shows a feature's journey
 * through the seven stages with its current position lit. Horizontal on
 * desktop, a vertical stepper on mobile. Off-pipeline states (e.g. rejected)
 * show a muted rail.
 */
export function PipelineRail({ status }: { status: string }) {
  const current = stageIndex(status);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-5">
      <p className="eyebrow mb-4">Delivery pipeline</p>

      {/* Desktop: horizontal rail */}
      <ol className="hidden items-center sm:flex">
        {STAGES.map((s, i) => {
          const state =
            current < 0 ? "idle" : i < current ? "done" : i === current ? "active" : "todo";
          const color = `var(${s.colorVar})`;
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <span
                  className="flex size-8 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors"
                  style={{
                    borderColor: state === "todo" || state === "idle" ? "var(--border)" : color,
                    backgroundColor:
                      state === "done" || state === "active" ? color : "transparent",
                    color:
                      state === "done" || state === "active"
                        ? "var(--background)"
                        : "var(--muted-foreground)",
                    boxShadow:
                      state === "active"
                        ? `0 0 0 4px color-mix(in oklch, ${color} 22%, transparent)`
                        : undefined,
                  }}
                >
                  {state === "done" ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[11px] font-medium",
                    state === "active" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span
                  className="mx-1 mb-6 h-px flex-1"
                  style={{
                    backgroundColor: i < current ? color : "var(--border)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: vertical stepper */}
      <ol className="space-y-0 sm:hidden">
        {STAGES.map((s, i) => {
          const state =
            current < 0 ? "idle" : i < current ? "done" : i === current ? "active" : "todo";
          const color = `var(${s.colorVar})`;
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                  style={{
                    borderColor: state === "todo" || state === "idle" ? "var(--border)" : color,
                    backgroundColor:
                      state === "done" || state === "active" ? color : "transparent",
                    color:
                      state === "done" || state === "active"
                        ? "var(--background)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {state === "done" ? <Check className="size-3" /> : i + 1}
                </span>
                {i < STAGES.length - 1 && (
                  <span
                    className="my-0.5 w-px flex-1"
                    style={{ backgroundColor: i < current ? color : "var(--border)" }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "pb-4 text-sm",
                  state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
