"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GripVertical, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

const COLUMNS: { status: TaskStatus; label: string; colorVar: string }[] = [
  { status: "BACKLOG", label: "Backlog", colorVar: "--stage-discovery" },
  { status: "TODO", label: "To do", colorVar: "--stage-tasks" },
  { status: "IN_PROGRESS", label: "In progress", colorVar: "--brand-accent" },
  { status: "IN_REVIEW", label: "In review", colorVar: "--stage-review" },
  { status: "DONE", label: "Done", colorVar: "--stage-approved" },
];

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  order: number;
  acceptanceRefs: unknown;
};

export function TaskBoard({
  featureId,
  planApproved,
}: {
  featureId: string;
  planApproved: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tasksOpts = trpc.task.byFeature.queryOptions({ featureRequestId: featureId });
  const tasksQuery = useQuery(tasksOpts);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: tasksOpts.queryKey });

  type TaskRow = NonNullable<typeof tasksQuery.data>[number];

  async function optimistic(patch: (prev: TaskRow[]) => TaskRow[]) {
    await queryClient.cancelQueries({ queryKey: tasksOpts.queryKey });
    const previous = queryClient.getQueryData(tasksOpts.queryKey);
    queryClient.setQueryData(tasksOpts.queryKey, (old) =>
      old ? patch(old) : old,
    );
    return { previous };
  }

  const move = useMutation(
    trpc.task.move.mutationOptions({
      onMutate: (vars) =>
        optimistic((prev) =>
          prev.map((t) =>
            t.id === vars.id ? { ...t, status: vars.status, order: vars.order } : t,
          ),
        ),
      onError: (e, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(tasksOpts.queryKey, ctx.previous);
        toast.error(e.message);
      },
      onSettled: invalidate,
    }),
  );
  const create = useMutation(
    trpc.task.create.mutationOptions({
      onSuccess: () => {
        setNewTitle("");
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const del = useMutation(
    trpc.task.delete.mutationOptions({
      onMutate: (vars) => optimistic((prev) => prev.filter((t) => t.id !== vars.id)),
      onError: (e, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(tasksOpts.queryKey, ctx.previous);
        toast.error(e.message);
      },
      onSettled: invalidate,
    }),
  );
  const regenerate = useMutation(
    trpc.task.regenerate.mutationOptions({
      onSuccess: () => toast.success("Regenerating tasks from the PRD…"),
      onError: (e) => toast.error(e.message),
    }),
  );
  const approvePlan = useMutation(
    trpc.task.approvePlan.mutationOptions({
      onSuccess: () => toast.success("Plan approved."),
      onError: (e) => toast.error(e.message),
    }),
  );

  const tasks = (tasksQuery.data ?? []) as Task[];

  function onDrop(status: TaskStatus) {
    setOverCol(null);
    if (!dragId) return;
    const colCount = tasks.filter((t) => t.status === status).length;
    move.mutate({ id: dragId, status, order: colCount });
    setDragId(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-base">Engineering tasks</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drag cards across the board · {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => regenerate.mutate({ featureRequestId: featureId })}
            disabled={regenerate.isPending}
          >
            <RefreshCw className={regenerate.isPending ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Regenerate</span>
          </Button>
          {planApproved ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{
                color: "var(--stage-approved)",
                borderColor: "color-mix(in oklch, var(--stage-approved) 35%, transparent)",
                backgroundColor: "color-mix(in oklch, var(--stage-approved) 12%, transparent)",
              }}
            >
              <CheckCircle2 className="size-3.5" /> Plan approved
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => approvePlan.mutate({ featureRequestId: featureId })}
              disabled={approvePlan.isPending || tasks.length === 0}
            >
              {approvePlan.isPending && <Loader2 className="animate-spin" />}
              Approve plan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {tasksQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading board…</p>
        ) : (
          // Horizontal-scroll board — comfortable columns on every screen size.
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
            <div className="flex min-w-max gap-3">
              {COLUMNS.map((col) => {
                const colTasks = tasks
                  .filter((t) => t.status === col.status)
                  .sort((a, b) => a.order - b.order);
                const isOver = overCol === col.status;
                const color = `var(${col.colorVar})`;
                return (
                  <div
                    key={col.status}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (overCol !== col.status) setOverCol(col.status);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node))
                        setOverCol((c) => (c === col.status ? null : c));
                    }}
                    onDrop={() => onDrop(col.status)}
                    className={cn(
                      "flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors",
                      isOver ? "bg-accent/40" : "bg-muted/20",
                    )}
                    style={
                      isOver
                        ? { borderColor: `color-mix(in oklch, ${color} 55%, transparent)` }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between px-1.5 py-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-semibold text-foreground">
                          {col.label}
                        </span>
                      </div>
                      <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>

                    {colTasks.length === 0 && !isOver && (
                      <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground/60">
                        No tasks
                      </div>
                    )}

                    {colTasks.map((task) => {
                      const done = task.status === "DONE";
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDragId(task.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverCol(null);
                          }}
                          className={cn(
                            "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-border/80 hover:shadow-md active:cursor-grabbing",
                            dragId === task.id && "opacity-40",
                          )}
                        >
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
                            <p
                              className={cn(
                                "flex-1 text-sm font-medium leading-snug",
                                done && "text-muted-foreground line-through",
                              )}
                            >
                              {task.title}
                            </p>
                            <button
                              onClick={() => del.mutate({ id: task.id })}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Delete task"
                            >
                              <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                          {task.description && (
                            <p className="mt-1.5 line-clamp-3 pl-5 text-xs text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                          {Array.isArray(task.acceptanceRefs) &&
                            task.acceptanceRefs.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1 pl-5">
                                {(task.acceptanceRefs as string[]).map((ref) => (
                                  <span
                                    key={ref}
                                    className="rounded border border-border/70 bg-muted px-1.5 font-mono text-[10px] text-muted-foreground"
                                  >
                                    {ref}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })}

                    {col.status === "BACKLOG" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newTitle.trim())
                            create.mutate({
                              featureRequestId: featureId,
                              title: newTitle.trim(),
                            });
                        }}
                        className="flex gap-1"
                      >
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Add task…"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          disabled={create.isPending}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
