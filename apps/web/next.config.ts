import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Load the monorepo-root .env so server code (Prisma, BetterAuth, AI SDK)
// sees the shared variables. Next only auto-loads .env from the app dir,
// but in this workspace the single source of truth lives at the repo root.
loadEnv({ path: resolve(process.cwd(), "../../.env") });

// Monorepo root (two levels up from apps/web).
const workspaceRoot = resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TS source and transpiled by the app.
  transpilePackages: [
    "@shipflow/api",
    "@shipflow/auth",
    "@shipflow/db",
    "@shipflow/ui",
  ],
  // Keep Prisma's native query engine out of the server bundle.
  // (Turbopack is the default builder in Next 16; a custom webpack config
  // would fail the build, so this is the supported way to externalize it.)
  serverExternalPackages: ["@prisma/client", "prisma"],

  // In this pnpm monorepo the Prisma client + native query engine live in
  // packages/db/generated/client. Next's file tracing is rooted at apps/web
  // by default and won't copy the engine .so into the serverless bundle,
  // causing "Query Engine could not be located" at runtime on Vercel.
  // Root the trace at the workspace and explicitly include the engine files.
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../packages/db/generated/client/**/*",
    ],
  },
};

export default nextConfig;
