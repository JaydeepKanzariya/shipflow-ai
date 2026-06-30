import { auth } from "./auth";

export { auth, type Auth } from "./auth";

export interface AuthContext {
  userId: string;
  activeOrganizationId: string | null;
}

/**
 * Resolves the auth principal from request headers via BetterAuth.
 * Returns null when unauthenticated. Consumed by the tRPC context factory.
 */
export async function getAuthFromHeaders(
  headers: Headers,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;

  return {
    userId: session.user.id,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  };
}
