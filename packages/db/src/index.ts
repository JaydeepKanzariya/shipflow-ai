export { prisma } from "./client";
// New Rust-free `prisma-client` generator: the main entry is generated
// `client.ts` (models, enums, and the Prisma namespace live here).
export * from "../generated/client/client";
export { Prisma } from "../generated/client/client";
