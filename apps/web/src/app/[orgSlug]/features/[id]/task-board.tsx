"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DONE", label: "Done" },
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
  const [newTitle, setNewTitle] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: tasksOpts.queryKey });

  type TaskRow = NonNullable<typeof tasksQuery.data>[number];

  /** Snapshot the cache and apply a local patch; returns rollback context. */
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
      // Optimistically move the card so drag-drop feels instant.
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
      // Optimistically remove the card — prevents the "nothing happened"
      // pause and the double-click NOT_FOUND error.
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
    if (!dragId) return;
    const colCount = tasks.filter((t) => t.status === status).length;
    move.mutate({ id: dragId, status, order: colCount });
    setDragId(null);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Engineering tasks</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => regenerate.mutate({ featureRequestId: featureId })}
            disabled={regenerate.isPending}
          >
            <RefreshCw className={regenerate.isPending ? "animate-spin" : ""} />
            Regenerate
          </Button>
          {planApproved ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" /> Plan approved
            </Badge>
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
          <div className="grid gap-3 md:grid-cols-5">
            {COLUMNS.map((col) => {
              const colTasks = tasks
                .filter((t) => t.status === col.status)
                .sort((a, b) => a.order - b.order);
              return (
                <div
                  key={col.status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(col.status)}
                  className="flex min-h-32 flex-col gap-2 rounded-lg border bg-muted/30 p-2"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {colTasks.length}
                    </span>
                  </div>
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragId(task.id)}
                      className="group cursor-grab rounded-md border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug">{task.title}</p>
                        <button
                          onClick={() => del.mutate({ id: task.id })}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Delete task"
                        >
                          <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                      {task.description && (
                        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      {Array.isArray(task.acceptanceRefs) &&
                        task.acceptanceRefs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(task.acceptanceRefs as string[]).map((ref) => (
                              <Badge
                                key={ref}
                                variant="outline"
                                className="font-mono text-[10px]"
                              >
                                {ref}
                              </Badge>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
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
                      <Button type="submit" size="icon" variant="ghost" className="h-8 w-8">
                        <Plus className="size-4" />
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
