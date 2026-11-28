/**
 * `response`, calling `finish` once its body is sent, or once the client stops reading it. A
 * streamed answer keeps working after the handler returns: an MCP tool call, for one, reaches the
 * database while its result streams, so the request's services must stay open until then.
 */
export function finishAfterResponse(response: Response, finish: () => void): Response {
  // A WebSocket upgrade has no body to wait for: the socket outlives the request.
  if (!response.body || response.status === 101) {
    finish()
    return response
  }
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  void response.body
    .pipeTo(writable)
    .catch(() => undefined)
    .finally(finish)
  return new Response(readable, response)
}
