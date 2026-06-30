// Placeholder for the BetterAuth configuration (wired in M2).
// Exposes the shape the API/web layers will consume so imports resolve today.

export interface AuthContext {
  userId: string;
  activeOrganizationId: string | null;
}

/**
 * Resolves the auth principal from request headers. Stubbed until M2 wires
 * BetterAuth; returns null (unauthenticated) for now.
 */
export async function getAuthFromHeaders(
  _headers: Headers,
): Promise<AuthContext | null> {
  return null;
}
