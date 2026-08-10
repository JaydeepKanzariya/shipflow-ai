"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Rocket, Sparkles } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Feature = {
  id: string;
  title: string;
  status: string;
  createdAt: string | Date;
  shippedAt: string | Date | null;
};

type DayItem = { feature: Feature; kind: "shipped" | "created" };

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function CalendarView({ orgSlug }: { orgSlug: string }) {
  const trpc = useTRPC();
  const featuresQuery = useQuery(trpc.featureRequest.list.queryOptions());
  const features = (featuresQuery.data ?? []) as Feature[];

  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Group features onto days by shipped date (primary) and created date.
  // Cheap over a small list; the React compiler handles memoization.
  const byDay = new Map<string, DayItem[]>();
  for (const f of features) {
    const push = (d: Date, item: DayItem) => {
      const k = dayKey(d);
      byDay.set(k, [...(byDay.get(k) ?? []), item]);
    };
    if (f.shippedAt) push(new Date(f.shippedAt), { feature: f, kind: "shipped" });
    push(new Date(f.createdAt), { feature: f, kind: "created" });
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build the 6-row grid (leading/trailing blanks included).
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Agenda (mobile): this month's items, chronological.
  const agenda: { date: Date; item: DayItem }[] = [];
  for (const [, list] of byDay) {
    for (const item of list) {
      const d =
        item.kind === "shipped"
          ? new Date(item.feature.shippedAt!)
          : new Date(item.feature.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month)
        agenda.push({ date: d, item });
    }
  }
  agenda.sort((a, b) => a.date.getTime() - b.date.getTime());

  const isToday = (d: Date) => dayKey(d) === dayKey(today);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Timeline</p>
          <h1 className="text-2xl font-semibold tracking-tight">Release calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            When features were created and shipped.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-display font-semibold">
            {MONTHS[month]} {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Rocket className="size-3.5" style={{ color: "var(--stage-shipped)" }} /> Shipped
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-muted-foreground" /> Created
        </span>
      </div>

      {featuresQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Desktop: month grid */}
          <Card className="hidden overflow-hidden md:block">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, i) => {
                const items = date ? byDay.get(dayKey(date)) ?? [] : [];
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-24 border-b border-r border-border p-1.5 last:border-r-0 nth-[7n]:border-r-0",
                      !date && "bg-muted/20",
                    )}
                  >
                    {date && (
                      <>
                        <div
                          className={cn(
                            "mb-1 flex size-6 items-center justify-center rounded-md text-xs",
                            isToday(date)
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {items.slice(0, 3).map((it, j) => (
                            <DayChip key={j} item={it} orgSlug={orgSlug} />
                          ))}
                          {items.length > 3 && (
                            <p className="pl-1 text-[10px] text-muted-foreground">
                              +{items.length - 3} more
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mobile: agenda list */}
          <div className="space-y-2 md:hidden">
            {agenda.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Nothing in {MONTHS[month]}.
                </CardContent>
              </Card>
            ) : (
              agenda.map(({ date, item }, i) => (
                <Link
                  key={i}
                  href={`/${orgSlug}/features/${item.feature.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex w-10 shrink-0 flex-col items-center">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {WEEKDAYS[date.getDay()]}
                    </span>
                    <span className="font-display text-lg font-semibold">
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.feature.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.kind === "shipped" ? (
                        <>
                          <Rocket className="size-3" style={{ color: "var(--stage-shipped)" }} />{" "}
                          Shipped
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-3" /> Created
                        </>
                      )}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DayChip({ item, orgSlug }: { item: DayItem; orgSlug: string }) {
  const shipped = item.kind === "shipped";
  const color = shipped ? "var(--stage-shipped)" : "var(--muted-foreground)";
  return (
    <Link
      href={`/${orgSlug}/features/${item.feature.id}`}
      className="block truncate rounded px-1.5 py-0.5 text-[11px] transition-colors hover:brightness-110"
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
        color,
      }}
      title={item.feature.title}
    >
      {shipped ? "🚀 " : ""}
      {item.feature.title}
    </Link>
  );
}
