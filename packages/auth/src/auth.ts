import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@shipflow/db";

/**
 * BetterAuth server instance for ShipFlow.
 *
 * - Prisma adapter over the shared @shipflow/db client (Neon PostgreSQL)
 * - Email/password + GitHub OAuth login
 * - Organization plugin for multi-tenant workspaces (members, invitations,
 *   and session.activeOrganizationId)
 * - nextCookies() so set-cookie works from server actions / route handlers
 */
export const auth = betterAuth({
  appName: "ShipFlow AI",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_APP_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET as string,
    },
  },

  plugins: [
    organization({
      // First member of a new org becomes its owner.
      creatorRole: "owner",
    }),
    // Must be last: forwards Set-Cookie from server actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
