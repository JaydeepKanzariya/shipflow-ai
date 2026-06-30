import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Load the monorepo-root .env so server code (Prisma, BetterAuth, AI SDK)
// sees the shared variables. Next only auto-loads .env from the app dir,
// but in this workspace the single source of truth lives at the repo root.
loadEnv({ path: resolve(process.cwd(), "../../.env") });

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
};

export default nextConfig;
