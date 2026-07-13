import { router } from "./trpc";
import { healthRouter } from "./routers/health";
import { organizationRouter } from "./routers/organization";
import { projectRouter } from "./routers/project";
import { featureRequestRouter } from "./routers/feature-request";
import { prdRouter } from "./routers/prd";
import { taskRouter } from "./routers/task";

/**
 * The ShipFlow tRPC root router. Remaining feature routers (tasks, github,
 * reviews, billing) are mounted here in later milestones.
 */
export const appRouter = router({
  health: healthRouter,
  organization: organizationRouter,
  project: projectRouter,
  featureRequest: featureRequestRouter,
  prd: prdRouter,
  task: taskRouter,
});

export type AppRouter = typeof appRouter;
