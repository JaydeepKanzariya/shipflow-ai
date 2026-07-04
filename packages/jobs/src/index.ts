import { featureClarify } from "./functions/feature-clarify";
import { prdGenerate } from "./functions/prd-generate";

export { inngest, type ShipflowEvents } from "./client";

/** All workflow functions, registered by the /api/inngest serve endpoint. */
export const functions = [featureClarify, prdGenerate];
