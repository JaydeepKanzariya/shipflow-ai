"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Browser auth client. baseURL defaults to the current origin, so it works in
 * local dev and on Vercel without per-env config.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useListOrganizations,
  useActiveOrganization,
  organization,
} = authClient;
