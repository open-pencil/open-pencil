import { createInterface } from 'node:readline'

import * as v from 'valibot'

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
  const waiting = new Map<number, (allowed: boolean) => void>()
  const allowed = new Set<string>()
  let next = 0
  createInterface({ input }).on('line', (line) => {
    const answer = v.safeParse(answerSchema, line)
    if (!answer.success) return
    waiting.get(answer.output.id)?.(answer.output.allowed)
    waiting.delete(answer.output.id)
  })
  return async (request) => {
    const key = `${request.access}:${request.path}`
    if (allowed.has(key) || (request.access === 'read' && allowed.has(`write:${request.path}`))) {
      return
    }
    const id = next++
    const answer = new Promise<boolean>((resolve) => waiting.set(id, resolve))
    output.write(`${JSON.stringify({ type: 'consent', id, ...request })}\n`)
    if (!(await answer)) {
      const verb = request.access === 'read' ? 'read' : 'write'
      throw new Error(`The person did not allow ${request.tool} to ${verb} ${request.path}.`)
    }
    allowed.add(key)
  }
}
