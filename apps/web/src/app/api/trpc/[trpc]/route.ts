import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@shipflow/api";
import { getAuthFromHeaders } from "@shipflow/auth";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // `req.headers` is a real Headers object here (no need for next/headers).
      const auth = await getAuthFromHeaders(req.headers);
      return createContext({ headers: req.headers, auth });
    },
    onError({ error, path }) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[trpc] error on '${path ?? "<no-path>"}':`, error.message);
      }
    },
  });

export { handler as GET, handler as POST };
