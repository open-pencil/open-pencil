import type { RPCJSONObject } from '#mcp/json'

/**
 * What MCP clients can reach: the whole document, or only the layers the user selected. In
 * selection scope the server exposes these read tools, stamps every call it sends to the app with
 * the scope, and the app rejects node IDs outside the selected layers and their descendants.
 */
export const MCP_TOOL_SCOPES = ['document', 'selection'] as const
export type MCPToolScope = (typeof MCP_TOOL_SCOPES)[number]

/** The tools selection scope keeps, each with the arguments that name the nodes it reads. */
export const SELECTION_SCOPE_TOOLS: Readonly<Record<string, readonly string[]>> = {
  get_selection: [],
  get_node: ['id'],
  get_page_tree: ['root_id'],
  describe: ['id', 'ids'],
  export_image: ['ids']
}

export function isSelectionScopeTool(name: string): boolean {
  return Object.hasOwn(SELECTION_SCOPE_TOOLS, name)
}

export function parseToolScope(value: string | undefined): MCPToolScope {
  const scope = value?.trim() || 'document'
  if (scope === 'document' || scope === 'selection') return scope
  throw new Error('OPENPENCIL_MCP_SCOPE must be "document" or "selection"')
}

/** The narrower of the scopes, so a client never offers more than the server it talks to. */
export function narrowestScope(...scopes: MCPToolScope[]): MCPToolScope {
  return scopes.includes('selection') ? 'selection' : 'document'
}

/** Why a selection-scoped call cannot write files, such as an export with a `path`. */
export const SELECTION_SCOPE_FILE_OUTPUT_ERROR =
  'Writing files is unavailable while OpenPencil shares only the selection; omit path'

/** Commands the app may receive in selection scope besides calls of the tools above. */
const SELECTION_SCOPE_COMMANDS: ReadonlySet<string> = new Set(['agent_session_closed'])

type RPCSend = (msg: RPCJSONObject) => Promise<unknown>

function toolName(msg: RPCJSONObject): string | null {
  const args = msg.args
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  const name = Reflect.get(args, 'name')
  return typeof name === 'string' ? name : null
}

/**
 * Sends to the app within the scope: in selection scope, only the selection tools and session
 * notices go through, each tool call carrying the scope however the client called it, so neither
 * `/rpc` nor a stale client can reach the rest of the document or the settings.
 */
export function scopeRPC(send: RPCSend, scope: MCPToolScope): RPCSend {
  if (scope === 'document') return send
  return async (msg) => {
    const command = typeof msg.command === 'string' ? msg.command : ''
    if (SELECTION_SCOPE_COMMANDS.has(command)) return send(msg)
    const name = command === 'tool' ? toolName(msg) : null
    if (!name || !isSelectionScopeTool(name)) {
      return {
        ok: false,
        error: `${name ?? command} is unavailable while OpenPencil shares only the selection with MCP clients`
      }
    }
    const args = msg.args as RPCJSONObject
    return send({ ...msg, args: { ...args, scope } })
  }
}
