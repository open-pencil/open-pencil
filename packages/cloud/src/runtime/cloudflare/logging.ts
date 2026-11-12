import type { CloudLogWriter, ForwardedRequestId } from '#cloud/server'

/** Workers Logs indexes the keys of an object passed to `console`, so the line goes as one. */
export const writeWorkersLogLine: CloudLogWriter = (line) => {
  console[line.level](line)
}

/** Cloudflare's ray ID, such as `8f1e2d3c4b5a6978-FRA`. */
const RAY_ID = /^[0-9a-f]{16}(-[A-Z]{3})?$/

/** Names a request by the ray ID Cloudflare's edge set on it, which a client cannot choose. */
export const cloudflareRayId: ForwardedRequestId = (headers) => {
  const ray = headers.get('cf-ray')
  return ray && RAY_ID.test(ray) ? ray : undefined
}
