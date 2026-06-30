import { getServerApi } from "@/trpc/server";
import { HealthCheck } from "./health-check";

export default async function Home() {
  // Server-side tRPC caller (no HTTP round-trip) — exercises the RSC path.
  const api = await getServerApi();
  const serverPing = await api.health.ping();

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">ShipFlow AI</h1>
        <p className="mt-2 text-white/60">
          Feature request → PRD → Tasks → Code → AI Review → Approval → Ship.
          Monorepo foundation is live.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <p className="font-mono">
          server tRPC:{" "}
          <span className="text-green-400">
            ok · {serverPing.service} · {serverPing.time}
          </span>
        </p>
      </div>

      <HealthCheck />

      <p className="text-xs text-white/40">
        M1 complete: pnpm + Turborepo workspace, Prisma data model, tRPC wired
        end to end (server caller + client React Query).
      </p>
    </main>
  );
}
