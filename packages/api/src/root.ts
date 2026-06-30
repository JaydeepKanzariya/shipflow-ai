import { router } from "./trpc";
import { healthRouter } from "./routers/health";

/**
 * The ShipFlow tRPC root router. Feature routers (organizations, projects,
 * featureRequests, prd, tasks, github, reviews, billing, workflows) are
 * mounted here in later milestones.
 */
export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
