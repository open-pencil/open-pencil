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
