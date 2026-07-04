import { serve } from "inngest/next";
import { inngest, functions } from "@shipflow/jobs";

// Inngest serves/executes all workflow functions here. The dev server
// (`npx inngest-cli dev`) and Inngest Cloud both call this endpoint.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
