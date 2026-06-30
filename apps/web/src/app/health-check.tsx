"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

/** Exercises the client tRPC + React Query path against health.ping. */
export function HealthCheck() {
  const trpc = useTRPC();
  const ping = useQuery(trpc.health.ping.queryOptions());

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
      <p className="font-mono">
        client tRPC:{" "}
        {ping.isLoading ? (
          <span className="text-yellow-400">checking…</span>
        ) : ping.isError ? (
          <span className="text-red-400">error: {ping.error.message}</span>
        ) : (
          <span className="text-green-400">
            ok · {ping.data?.service} · {ping.data?.time}
          </span>
        )}
      </p>
    </div>
  );
}
