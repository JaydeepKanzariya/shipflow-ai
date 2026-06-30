import type { NextConfig } from "next";

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
