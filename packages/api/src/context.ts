import { prisma } from "@shipflow/db";

/**
 * Shape of an authenticated principal. Populated by the auth layer (M2);
 * null when the request is unauthenticated.
 */
export interface AuthContext {
  userId: string;
  activeOrganizationId: string | null;
}

export interface CreateContextOptions {
  /** Request headers, already resolved by the caller (Next's `headers()` is async). */
  headers: Headers;
  /** Resolved auth principal, or null. Wired to BetterAuth in M2. */
  auth: AuthContext | null;
}

/**
 * Inner context — everything a procedure can access. Kept separate so it can
 * be constructed directly in tests without a real request.
 */
export function createInnerContext(opts: { auth: AuthContext | null; headers: Headers }) {
  return {
    db: prisma,
    auth: opts.auth,
    headers: opts.headers,
  };
}

export type Context = ReturnType<typeof createInnerContext>;

/**
 * Per-request context factory used by the route handler.
 * Auth resolution is injected by the caller (route handler) to keep this
 * package free of Next.js / BetterAuth imports.
 */
export async function createContext(opts: CreateContextOptions): Promise<Context> {
  return createInnerContext({ auth: opts.auth, headers: opts.headers });
}
