import { bytesToHex } from '@noble/hashes/utils.js'
import * as v from 'valibot'

/**
 * Design tools an app runs on a Cloud document through the editor that has it open: the server
 * holds no editor, so a call goes through the document's collaboration room to an editor tab of
 * the person whose token made it, which runs the tool as it runs a local MCP server's calls, and
 * its edits reach everyone in the room as that person's. The room's `agent-tools` channel carries
 * the local MCP server's own messages (`@open-pencil/collab/automation`), a call as a `tool`
 * request.
 */

/** Where an MCP client reaches the server's tools, under the server's public URL. */
export const CLOUD_MCP_PATH = '/mcp'

/** The MCP endpoint as a protected resource: what MCP clients name in `resource`. */
export const cloudMCPResource = (publicURL: string) => new URL(CLOUD_MCP_PATH, publicURL).href

/** The longest a tool or agent name may be, as the editor's tools and presence take them. */
export const MAX_AGENT_TOOL_NAME_LENGTH = 128

const toolNameSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z][a-z0-9_]*$/),
  v.maxLength(MAX_AGENT_TOOL_NAME_LENGTH)
)

/**
 * Who makes a call, as the editor shows the agent at work: the app or token that made it, and the
 * name its person sees for it, each at most `MAX_AGENT_TOOL_NAME_LENGTH` long.
 */
export type AgentToolCaller = { session: string; client?: string }

/** A design tool an app runs on a document, as the server hands it to an editor. */
export type AgentToolCall = {
  name: string
  args: Record<string, unknown>
  agent: AgentToolCaller
}

/** A tool call as the document API takes it. */
export const cloudDocumentToolCallSchema = v.object({
  name: toolNameSchema,
  args: v.optional(v.record(v.string(), v.unknown()), {})
})
export type CloudDocumentToolCall = v.InferOutput<typeof cloudDocumentToolCallSchema>

/**
 * Why a call got no answer: nobody who may run it has the document open, the editor that took it
 * failed it or left, or it took too long.
 */
const agentToolFailureSchema = v.picklist(['editor_not_open', 'tool_failed', 'timeout'])

/** What came of a call carried to an editor: what the tool answered, or why there is no answer. */
export const agentToolOutcomeSchema = v.variant('ok', [
  v.object({ ok: v.literal(true), result: v.unknown() }),
  v.object({
    ok: v.literal(false),
    failure: agentToolFailureSchema,
    message: v.optional(v.string())
  })
])
export type AgentToolOutcome = v.InferOutput<typeof agentToolOutcomeSchema>

/**
 * A tab of a server's editor can pair itself with a coding agent without an account: the tab makes
 * a pairing token, the person gives it to their agent as its MCP bearer token, and the server
 * carries the agent's design tool calls to the tab holding it. The server keeps neither the token
 * nor anything the tab sends; a pairing ends when its tab disconnects.
 */
export const CLOUD_AGENT_PAIRING_TOKEN_PREFIX = 'opg_'

/**
 * What a paired agent may ask its editor besides design tools: the local MCP server's own commands
 * that list, make, and show the editor's open documents. Files, settings, and code stay local.
 */
export const AGENT_PAIRING_COMMANDS = [
  'list_documents',
  'create_document',
  'activate_document'
] as const
export type AgentPairingCommand = (typeof AGENT_PAIRING_COMMANDS)[number]

/** A whole pairing token, as a browser makes one. */
export const agentPairingTokenSchema = v.pipe(v.string(), v.regex(/^opg_[0-9a-f]{64}$/))

/** Where a paired tab connects, on the API origin, with its pairing's ID as `pairing`. */
export const AGENT_PAIRING_RELAY_PATH = '/api/agent-pairing/relay'
export const AGENT_PAIRING_PARAM = 'pairing'

/** Whether a bearer token is a pairing token rather than an account's. */
export function isAgentPairingToken(token: string): boolean {
  return token.startsWith(CLOUD_AGENT_PAIRING_TOKEN_PREFIX)
}

/**
 * A pairing's ID: its token's SHA-256 in hex. It names where the tab connects without the token
 * itself appearing in an address; the tab still proves it holds the token once connected.
 */
export async function agentPairingId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return bytesToHex(new Uint8Array(digest))
}

/** The WebSocket address a tab of pairing `pairingId` connects to on the server at `publicURL`. */
export function agentPairingURL(publicURL: string, pairingId: string): string {
  const url = new URL(AGENT_PAIRING_RELAY_PATH, publicURL)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set(AGENT_PAIRING_PARAM, pairingId)
  return url.href
}

/** A pairing ID as it appears in an address. */
export const agentPairingIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
