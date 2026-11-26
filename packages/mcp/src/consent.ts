import { createInterface } from 'node:readline'

import * as v from 'valibot'

import { createDeferred } from '@open-pencil/std/async'

/** Whether a tool reads a file or writes one. */
export type PathAccess = 'read' | 'write'

export interface PathConsentRequest {
  /** The tool that names the file. */
  tool: string
  access: PathAccess
  /** The file's canonical path, inside the MCP root. */
  path: string
  /** The MCP client's own name, as it introduced itself, such as `claude-code`. */
  client?: string
}

/**
 * Asks whether a tool may read or write a file a caller named. Resolves once allowed and throws
 * once refused. A server without one lets every path inside its root through.
 */
export type PathConsent = (request: PathConsentRequest) => Promise<void>

/**
 * Asks `consent`, when the server asks at all, before `tool` reads or writes a path, naming the
 * client by the name it introduced itself with.
 */
export function askPath(consent: PathConsent | undefined, client: () => string | undefined) {
  return (tool: string, access: PathAccess) => async (path: string) => {
    await consent?.({ tool, access, path, client: client() })
  }
}

/**
 * The tools whose files the app itself opens or saves, so allowing one also gives the app the
 * file; `EDITOR_FILE_TOOLS` in `desktop/src/host/mcp.rs`. An answer for another tool does not
 * stand in for theirs.
 */
const DOCUMENT_TOOLS = new Set([
  'open_document',
  'save_document',
  'create_document',
  'close_document'
])

const answerSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ type: v.literal('consent'), id: v.number(), allowed: v.boolean() })
)

/**
 * Asks the program that started the server, over the server's standard streams: a JSON line
 * `{ type: 'consent', id, tool, access, path, client }` out, and `{ type: 'consent', id, allowed }`
 * back. The desktop app starts the server this way and asks the person in a window of its own,
 * which neither the editor nor an agent can answer. An answer holds for the server's lifetime,
 * so saving the same file again does not ask again.
 */
export function stdioPathConsent(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream
): PathConsent {
  const waiting = new Map<number, ReturnType<typeof createDeferred<boolean>>>()
  const allowed = new Set<string>()
  let next = 0
  let closed = false
  const closedError = () =>
    new Error("The app that answers file questions closed the server's standard input.")
  createInterface({ input })
    .on('line', (line) => {
      const answer = v.safeParse(answerSchema, line)
      if (!answer.success) return
      waiting.get(answer.output.id)?.resolve(answer.output.allowed)
      waiting.delete(answer.output.id)
    })
    // No answer can come any more: what waits fails, and so does every later question.
    .on('close', () => {
      closed = true
      for (const question of waiting.values()) question.reject(closedError())
      waiting.clear()
    })
  return async (request) => {
    const kind = DOCUMENT_TOOLS.has(request.tool) ? 'document' : 'file'
    const key = `${kind}:${request.access}:${request.path}`
    if (
      allowed.has(key) ||
      (request.access === 'read' && allowed.has(`${kind}:write:${request.path}`))
    ) {
      return
    }
    if (closed) throw closedError()
    const id = next++
    const answer = createDeferred<boolean>()
    waiting.set(id, answer)
    output.write(`${JSON.stringify({ type: 'consent', id, ...request })}\n`)
    if (!(await answer.promise)) {
      const verb = request.access === 'read' ? 'read' : 'write'
      throw new Error(`The person did not allow ${request.tool} to ${verb} ${request.path}.`)
    }
    allowed.add(key)
  }
}
