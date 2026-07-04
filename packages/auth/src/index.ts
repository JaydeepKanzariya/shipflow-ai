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

/**
 * Ensure the session's active organization matches the org the user is
 * viewing (path-based tenancy). Called from the org layout so that a member
 * landing on /[orgSlug]/* always has that org active — even if they signed in
 * without an active org set. Returns the resolved active org id, or null if
 * not authenticated.
 */
export async function setActiveOrganization(
  headers: Headers,
  organizationId: string,
): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  if (session.session.activeOrganizationId === organizationId) {
    return organizationId;
  }
  await auth.api.setActiveOrganization({
    headers,
    body: { organizationId },
  });
  return organizationId;
}
