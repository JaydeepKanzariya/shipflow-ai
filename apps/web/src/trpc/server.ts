import "server-only";
import { headers } from "next/headers";
import { createCallerFactory, appRouter, createContext } from "@shipflow/api";
import { getAuthFromHeaders } from "@shipflow/auth";

const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC caller for use inside Server Components / route handlers.
 * Resolves the request headers (async in Next 16) and the auth principal,
 * then invokes procedures in-process (no HTTP round-trip).
 */
export async function getServerApi() {
  const h = await headers();
  const auth = await getAuthFromHeaders(h);
  const ctx = await createContext({ headers: h, auth });
  return createCaller(ctx);
}
