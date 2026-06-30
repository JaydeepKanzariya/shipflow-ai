import { auth } from "@shipflow/auth";
import { toNextJsHandler } from "better-auth/next-js";

// BetterAuth mounts all auth endpoints under /api/auth/*
export const { POST, GET } = toNextJsHandler(auth);
