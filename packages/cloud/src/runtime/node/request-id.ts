import type { ForwardedRequestId } from '#cloud/server'

/** What a proxy's `X-Request-Id` may hold to be kept. */
const PROXY_REQUEST_ID = /^[\w-]{1,128}$/

/**
 * Names a request by the `X-Request-Id` a proxy in front set, such as nginx's `$request_id`, so
 * the proxy's log and the server's agree.
 */
export const proxyRequestId: ForwardedRequestId = (headers) => {
  const id = headers.get('x-request-id')
  return id && PROXY_REQUEST_ID.test(id) ? id : undefined
}
