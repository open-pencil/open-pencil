/**
 * Bun augments the global `fetch` with a `preconnect` namespace, so a bare async function is not
 * a `typeof fetch`. Wrap a request handler to get a stub that satisfies the full global shape.
 */
export function fetchStub(
  handler: (input: string | URL | Request, init?: BunFetchRequestInit) => Promise<Response>
): typeof fetch {
  return Object.assign(handler, { preconnect: fetch.preconnect })
}
