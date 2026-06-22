/**
 * middleware.ts — Entry point for Next.js Edge Middleware.
 *
 * Next.js requires this file to be named exactly `middleware.ts` at the
 * project root. The implementation lives in `proxy.ts` (kept separate so it
 * can be unit-tested without the Edge runtime constraint).
 *
 * This file simply re-exports the middleware function and the route matcher
 * config from proxy.ts — no logic lives here.
 */
export { proxy as middleware, config } from './proxy'
