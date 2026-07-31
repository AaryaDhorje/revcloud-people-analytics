import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The FastAPI backend is served from `/api/py/*`.
 *
 * In development it runs as a standalone uvicorn process on :8000, and Next
 * proxies to it so the browser still sees a single origin (which keeps the
 * httpOnly auth cookies first-party).
 *
 * In production every `/api/py/*` request is rewritten onto the single Vercel
 * Python function at `api/index.py`, which receives the original path and
 * routes internally.
 */
const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin requests to dev-only resources (HMR, client
  // chunks) by default. The dev server's own origin is `localhost`, so hitting
  // it as `127.0.0.1` — which curl, Playwright and some browsers do — gets the
  // client bundle blocked and the page silently never hydrates. Dev only; has
  // no effect on the production build.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  rewrites: async () => [
    {
      source: "/api/py/:path*",
      destination: isDev
        ? "http://127.0.0.1:8000/api/py/:path*"
        : "/api/index",
    },
  ],
};

export default nextConfig;
