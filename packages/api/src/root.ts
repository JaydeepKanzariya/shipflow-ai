import { router } from "./trpc";
import { healthRouter } from "./routers/health";
import { organizationRouter } from "./routers/organization";

/**
 * The ShipFlow tRPC root router. Feature routers (projects, featureRequests,
 * prd, tasks, github, reviews, billing, workflows) are mounted here in later
 * milestones.
 */
export const appRouter = router({
  health: healthRouter,
  organization: organizationRouter,
});

export type AppRouter = typeof appRouter;
