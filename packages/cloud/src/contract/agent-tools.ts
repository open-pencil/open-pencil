import * as v from 'valibot'

/**
 * Design tools an app runs on a Cloud document through the editor that has it open: the server
 * holds no editor, so a call goes through the document's collaboration room to an editor tab of
 * the person whose token made it, which runs the tool as it runs a local MCP server's calls, and
 * its edits reach everyone in the room as that person's.
 */

/** Where an MCP client reaches the server's tools, under the server's public URL. */
export const CLOUD_MCP_PATH = '/mcp'

/** The MCP endpoint as a protected resource: what MCP clients name in `resource`. */
export const cloudMCPResource = (publicURL: string) => new URL(CLOUD_MCP_PATH, publicURL).href

/** The longest a tool or agent name may be, as the editor's tools and presence take them. */
export const MAX_AGENT_TOOL_NAME_LENGTH = 128
const MAX_NAME_LENGTH = MAX_AGENT_TOOL_NAME_LENGTH

const toolNameSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z][a-z0-9_]*$/),
  v.maxLength(MAX_NAME_LENGTH)
)

/**
 * Who makes a call, as the editor shows the agent at work: the app or token that made it, and the
 * name its person sees for it.
 */
export const agentToolCallerSchema = v.object({
  session: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_NAME_LENGTH)),
  client: v.optional(v.pipe(v.string(), v.maxLength(MAX_NAME_LENGTH)))
})
export type AgentToolCaller = v.InferOutput<typeof agentToolCallerSchema>

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

/** What a tool answered, as the document API returns it. */
export const cloudDocumentToolResultSchema = v.object({ result: v.unknown() })

/**
 * Why a call got no answer: nobody who may run it has the document open, the editor that took it
 * failed it or left, or it took too long.
 */
export const CLOUD_DOCUMENT_TOOL_FAILURES = ['editor_not_open', 'tool_failed', 'timeout'] as const
export type CloudDocumentToolFailure = (typeof CLOUD_DOCUMENT_TOOL_FAILURES)[number]

/** What the relay hands back for a call it carried to an editor, or why it could not. */
export type AgentToolOutcome =
  | { ok: true; result: unknown }
  | { ok: false; failure: CloudDocumentToolFailure; message?: string }

const callIdSchema = v.pipe(v.string(), v.uuid())

/**
 * The messages on a room's `agent-tools` channel, all between an editor and the relay: an editor
 * that can run tools says so each time it joins, the relay hands it a call, and the editor
 * answers it; a call the relay stopped waiting for is cancelled, so one still waiting for its
 * turn never runs. Editors never send them to each other.
 */
export const agentToolMessageSchema = v.variant('type', [
  v.object({ type: v.literal('host') }),
  v.object({
    type: v.literal('call'),
    id: callIdSchema,
    name: toolNameSchema,
    args: v.record(v.string(), v.unknown()),
    agent: agentToolCallerSchema
  }),
  v.object({ type: v.literal('cancel'), id: callIdSchema }),
  v.object({
    type: v.literal('result'),
    id: callIdSchema,
    ok: v.literal(true),
    result: v.unknown()
  }),
  v.object({
    type: v.literal('result'),
    id: callIdSchema,
    ok: v.literal(false),
    error: v.pipe(v.string(), v.maxLength(4096))
  })
])
export type AgentToolMessage = v.InferOutput<typeof agentToolMessageSchema>

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function encodeAgentToolMessage(message: AgentToolMessage): Uint8Array {
  return encoder.encode(JSON.stringify(message))
}

/** The message a room payload carries, or null when it is not one. */
export function decodeAgentToolMessage(payload: Uint8Array): AgentToolMessage | null {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), agentToolMessageSchema),
    decoder.decode(payload)
  )
  return parsed.success ? parsed.output : null
}
