import { PrismaClient } from "../generated/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use the Neon serverless driver adapter. This runs queries over Neon's
// driver (HTTP/WebSocket) instead of Prisma's native Rust query engine,
// which is what makes it work reliably on Vercel serverless without needing
// the platform-specific libquery_engine binary in the function bundle.
function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
