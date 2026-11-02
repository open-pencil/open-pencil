import { createFeedbackClient } from '@lawha/feedback/client'

/**
 * The app's one client for the feedback service: pings, usage stats, and Cloud waitlist sign-ups.
 * It holds the browser's own `fetch`, taken when the app loads. Core's web-font loader swaps the
 * global `fetch` while providers load and refuses hosts other than font CDNs, which would drop a
 * ping sent at startup (`browser-fetch.ts` takes it the same way).
 */
export const feedback = createFeedbackClient({ fetch: globalThis.fetch.bind(globalThis) })
