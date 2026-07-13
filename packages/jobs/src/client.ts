import { EventSchemas, Inngest } from "inngest";

/**
 * Typed event catalog. tRPC mutations send these; workflows consume them.
 * Keeping the schema here makes `inngest.send(...)` type-safe app-wide.
 */
type Events = {
  "feature.submitted": {
    data: { featureRequestId: string; workflowRunId: string };
  };
  "feature.clarified": {
    data: { featureRequestId: string; workflowRunId: string };
  };
  "prd.generate.requested": {
    data: { featureRequestId: string; workflowRunId: string };
  };
  "tasks.generate.requested": {
    data: { featureRequestId: string; workflowRunId: string };
  };
};

export const inngest = new Inngest({
  id: "shipflow",
  schemas: new EventSchemas().fromRecord<Events>(),
});

export type ShipflowEvents = Events;
