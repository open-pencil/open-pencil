import * as v from 'valibot'

/** A request the MCP endpoint makes of the server's own document API. */
export type MCPAPIRequest = (
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
) => Promise<{ status: number; body: unknown }>

const responseBodySchema = v.pipe(v.string(), v.parseJson())

/**
 * The document API as the MCP endpoint reaches it: each tool is a request to the server's own
 * routes with the caller's `Authorization`, so a tool is held to exactly what the token reaches
 * there, its scopes, workspace, and limits alike.
 */
export function createMCPAPIRequest(
  fetchAPI: (request: Request) => Response | Promise<Response>,
  publicURL: string,
  authorization: string
): MCPAPIRequest {
  return async (method, path, body) => {
    const headers = new Headers({ authorization })
    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      headers.set('content-type', 'application/json')
      init.body = JSON.stringify(body)
    }
    const response = await fetchAPI(new Request(new URL(path, publicURL), init))
    const text = await response.text()
    const parsed = v.safeParse(responseBodySchema, text)
    return { status: response.status, body: parsed.success ? parsed.output : text || null }
  }
}
