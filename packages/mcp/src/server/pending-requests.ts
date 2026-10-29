import type {
  ServerContext,
  WebStandardStreamableHTTPServerTransport
} from '@modelcontextprotocol/server'

const REQUEST_CANCELLED = -32800

/**
 * In JSON response mode the SDK never settles the HTTP response of a request
 * that was cancelled or that was still running when the transport closed.
 * This tracks each POST so both cases can be answered.
 */
export function createPendingRequests(transport: WebStandardStreamableHTTPServerTransport) {
  const waiting = new Map<Request, (response: Response) => void>()
  let closed = false

  function settled(request: Request): Promise<Response> {
    if (closed) return Promise.resolve(sessionNotFound())
    return new Promise((resolve) => {
      waiting.set(request, resolve)
    })
  }

  async function handle(request: Request): Promise<Response> {
    const handling = transport.handleRequest(request)
    if (request.method !== 'POST') return handling
    try {
      return await Promise.race([handling, settled(request)])
    } finally {
      waiting.delete(request)
    }
  }

  /** End a cancelled tool call's HTTP request without a JSON-RPC result. */
  async function releaseCancelled(context: ServerContext): Promise<void> {
    const request = context.http?.req
    const respond = request && waiting.get(request)
    if (!respond || !context.mcpReq.signal.aborted) return
    respond(new Response(null, { status: 202 }))
    // The SDK drops the cancelled result, so its stream bookkeeping waits for
    // a response that never comes. Send one to release it.
    await transport
      .send({
        jsonrpc: '2.0',
        id: context.mcpReq.id,
        error: { code: REQUEST_CANCELLED, message: 'Request cancelled' }
      })
      .catch(() => undefined)
  }

  function close() {
    closed = true
    for (const respond of waiting.values()) respond(sessionNotFound())
    waiting.clear()
  }

  return { close, handle, releaseCancelled }
}

function sessionNotFound() {
  return Response.json({ error: 'MCP session not found' }, { status: 404 })
}
