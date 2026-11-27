/** The app's side of tool calls: the RPC envelope, and the document and page a call targets. */
import * as v from 'valibot'

export type RPCSender = (body: Record<string, unknown>) => Promise<unknown>

/**
 * The document and page a call targets when not the active ones. Every document tool takes them,
 * so they carry no description: their names say it, and list_documents gives the IDs.
 */
export const automationTargetSchema = {
  document_id: v.optional(v.string()),
  page_id: v.optional(v.string())
}

export function splitAutomationTarget(args: Record<string, unknown>): {
  target: { document_id?: string; page_id?: string }
  args: Record<string, unknown>
} {
  const { document_id, page_id, ...rest } = args
  const target: { document_id?: string; page_id?: string } = {}
  if (typeof document_id === 'string') target.document_id = document_id
  if (typeof page_id === 'string') target.page_id = page_id
  return { target, args: rest }
}

export type RPCResponse = { ok?: boolean; result?: unknown; target?: unknown; error?: string }

export async function sendCommand(
  sendRPC: RPCSender,
  command: string,
  args: Record<string, unknown>
): Promise<RPCResponse> {
  const res = (await sendRPC({ command, args })) as RPCResponse
  if (res.ok === false) throw new Error(res.error)
  return res
}

export function withTarget<T extends object>(body: T, res: RPCResponse): T & { target?: unknown } {
  return res.target ? { ...body, target: res.target } : body
}
