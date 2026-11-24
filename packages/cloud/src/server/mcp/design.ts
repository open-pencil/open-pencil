import {
  CLOUD_DOCUMENT_TOOL_FAILURES,
  cloudDocumentToolResultSchema,
  type AgentToolCall,
  type AgentToolOutcome
} from '#cloud/contract'
import { scopesAllow } from '#cloud/server/tokens'
import type { McpServer } from '@modelcontextprotocol/server'
import * as v from 'valibot'

import { DESIGN_TOOLS, type DesignTool } from './catalog'
import { apiFailure, documentLink, type MCPCaller } from './context'
import { apiError, designToolResult, errorResult } from './results'
import { jsonToolInput } from './schema'

const PAGE_PROPERTY = {
  page_id: {
    type: 'string',
    description: 'The page to work on; the page the editor shows when left out.'
  }
}

/** What a design tool takes besides its own input: the page, and the document when it names one. */
const DOCUMENT_PROPERTIES = {
  document_id: {
    type: 'string',
    format: 'uuid',
    description: 'The Cloud document to work on, as list_documents names it.'
  },
  ...PAGE_PROPERTY
}

/** A design tool's input as clients read it: its own, with what it works on. */
function targetedSchema(
  tool: DesignTool,
  target: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  const properties = v.safeParse(v.record(v.string(), v.unknown()), tool.inputSchema.properties)
  const own = v.safeParse(v.array(v.string()), tool.inputSchema.required)
  return {
    ...tool.inputSchema,
    properties: { ...(properties.success ? properties.output : {}), ...target },
    required: [...(own.success ? own.output : []), ...required]
  }
}

/** A call's outcome as the model reads it, `notOpen` saying how to get an editor to run it. */
function outcomeResult(tool: DesignTool, outcome: AgentToolOutcome, notOpen: string) {
  if (outcome.ok) return designToolResult(outcome.result)
  if (outcome.failure === 'editor_not_open') return errorResult(notOpen)
  if (outcome.failure === 'tool_failed')
    return errorResult(outcome.message ?? `${tool.name} failed.`)
  return errorResult(
    `The editor did not answer ${tool.name} in time. Try a smaller change, or check that OpenPencil is still open.`
  )
}

const failureSchema = v.picklist(CLOUD_DOCUMENT_TOOL_FAILURES)

/**
 * Registers Core's design tools on Cloud documents, as far as the token's scopes go. The server
 * holds no editor: each call goes to an editor tab where the person who connected the app has the
 * document open, which runs it as their own edit, as a local MCP server's calls run in the app.
 */
export function registerDesignTools(server: McpServer, caller: MCPCaller) {
  for (const tool of DESIGN_TOOLS) {
    const scope = tool.mutates ? 'documents:write' : 'documents:read'
    if (!scopesAllow(caller.scopes, scope)) continue
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonToolInput(
          `document:${tool.name}`,
          targetedSchema(tool, DOCUMENT_PROPERTIES, ['document_id'])
        ),
        annotations: { readOnlyHint: !tool.mutates, openWorldHint: false }
      },
      async (args) => {
        const { document_id: documentId, ...toolArgs } = args
        if (typeof documentId !== 'string') return errorResult('Name the document_id to work on.')
        const { status, body } = await caller.api(
          'POST',
          `/api/documents/${documentId}/tools/${tool.mutates ? 'write' : 'read'}`,
          { name: tool.name, args: toolArgs }
        )
        const answered = v.safeParse(cloudDocumentToolResultSchema, body)
        if (status === 200 && answered.success) return designToolResult(answered.output.result)
        const error = apiError(body)
        const failure = v.safeParse(failureSchema, error?.code)
        if (!failure.success) return apiFailure(status, body)
        return outcomeResult(
          tool,
          { ok: false, failure: failure.output, message: error?.message },
          `Design tools run in OpenPencil, in an editor where you have the document open, and none has it open now. Ask the person to open ${documentLink(caller, documentId)} and keep it open, then call again.`
        )
      }
    )
  }
}

/** Runs a design tool in the editor tab paired with the token. */
export type RunPairedTool = (call: Omit<AgentToolCall, 'agent'>) => Promise<AgentToolOutcome>

/**
 * Registers Core's design tools for an agent paired with an editor tab: they work on the document
 * the tab shows, as a local MCP server's calls work on the active one, with no account behind them.
 */
export function registerPairedDesignTools(server: McpServer, run: RunPairedTool) {
  for (const tool of DESIGN_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonToolInput(`tab:${tool.name}`, targetedSchema(tool, PAGE_PROPERTY, [])),
        annotations: { readOnlyHint: !tool.mutates, openWorldHint: false }
      },
      async (args) =>
        outcomeResult(
          tool,
          await run({ name: tool.name, args }),
          'No OpenPencil tab is paired with this connection now. In OpenPencil, open Settings → MCP and connect an agent again, then use the new connection.'
        )
    )
  }
}
