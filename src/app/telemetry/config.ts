/**
 * Whether this build may send anything. Only official release builds set the flag, so forks,
 * self-built apps, dev servers, and tests send no pings or usage stats.
 */
// Off: the only feedback server belongs to the upstream project. Lawha sends nothing.
export const FEEDBACK_ENABLED = false
