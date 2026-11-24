import type { AgentToolCall, AgentToolOutcome } from '#cloud/contract'
import { scopesAllow } from '#cloud/server/tokens'
import type { McpServer } from '@modelcontextprotocol/server'
import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import { DESIGN_TOOLS, takesPath, type DesignTool } from './catalog'
import { answering, documentLink, type MCPCaller } from './context'
import { designToolResult, errorResult } from './results'
import { jsonToolInput, toolInput } from './schema'

const PAIRED_PROPERTIES = {
  document_id: {
    type: 'string',
    description:
      'An open document, as list_documents names it; the one this connection last worked on when left out.'
  },
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
  page_id: PAIRED_PROPERTIES.page_id
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
function outcomeResult(tool: string, outcome: AgentToolOutcome, notOpen: string) {
  if (outcome.ok) return designToolResult(outcome.result)
  if (outcome.failure === 'editor_not_open') return errorResult(notOpen)
  if (outcome.failure === 'tool_failed') return errorResult(outcome.message ?? `${tool} failed.`)
  return errorResult(
    `The editor did not answer ${tool} in time. Try a smaller change, or check that OpenPencil is still open.`
  )
}

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
        annotations: { readOnlyHint: tool.readOnly, openWorldHint: false }
      },
      async (args) => {
        const { document_id: documentId, ...toolArgs } = args
        if (typeof documentId !== 'string') return errorResult('Name the document_id to work on.')
        return answering(async () =>
          outcomeResult(
            tool.name,
            await caller.api.documentTools[tool.mutates ? 'write' : 'read']({
              params: { documentId },
              body: { name: tool.name, args: toolArgs }
            }),
            `Design tools run in OpenPencil, in an editor where you have the document open, and none has it open now. Ask the person to open ${documentLink(caller, documentId)} and keep it open, then call again.`
          )
        )
      }
    )
  }
}

/** The tools on the paired editor's open documents, which the editor runs as it does a local agent's. */
const PAIRED_DOCUMENT_TOOLS = [
  {
    name: 'list_documents',
    description: 'List the documents open in the paired OpenPencil, with their IDs and pages.',
    input: v.object({})
  },
  {
    name: 'create_document',
    description: 'Open a new empty design in the paired OpenPencil and work on it.',
    input: v.object({})
  },
  {
    name: 'activate_document',
    description: 'Show an open document in the paired OpenPencil, and a page of it when named.',
    input: v.object({ document_id: v.string(), page_id: v.optional(v.string()) })
  }
]

/** Runs a design tool in the editor tab paired with the token. */
export type RunPairedTool = (call: Omit<AgentToolCall, 'agent'>) => Promise<AgentToolOutcome>

/**
 * Registers Core's design tools for an agent paired with an editor, and the ones that list, make,
 * and switch its open documents: they work as a local MCP server's calls do, with no account behind
 * them.
 */
export function registerPairedDesignTools(server: McpServer, run: RunPairedTool) {
  const answer = async (name: string, args: Record<string, unknown>) =>
    outcomeResult(
      name,
      await run({ name, args }),
      'OpenPencil is not open in the browser this connection was made in. Ask the person to open it there, then call again; if they disconnected, connect again.'
    )
  for (const tool of PAIRED_DOCUMENT_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: toolInput(tool.input),
        annotations: { readOnlyHint: tool.name === 'list_documents', openWorldHint: false }
      },
      (args) => answer(tool.name, args)
    )
  }
  for (const tool of DESIGN_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonToolInput(`tab:${tool.name}`, targetedSchema(tool, PAIRED_PROPERTIES, [])),
        annotations: { readOnlyHint: tool.readOnly, openWorldHint: false }
      },
      // No disk of the caller's here: a file `path` would only change what the tool answers.
      (args) => answer(tool.name, takesPath(tool) ? args : omit(args, ['path']))
    )
  }
}
