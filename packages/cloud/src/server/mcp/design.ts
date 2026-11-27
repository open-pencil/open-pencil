import { scopesAllow } from '#cloud/server/tokens'
import type { McpServer } from '@modelcontextprotocol/server'
import * as v from 'valibot'

import { DESIGN_TOOLS, type DesignTool } from './catalog'
import { answering, documentLink, type MCPCaller } from './context'
import { designToolResult, errorResult } from './results'
import { jsonToolInput } from './schema'

/** What every design tool takes besides its own input: the document, and a page in it. */
const TARGET_PROPERTIES = {
  document_id: {
    type: 'string',
    format: 'uuid',
    description: 'The Cloud document to work on, as list_documents names it.'
  },
  page_id: {
    type: 'string',
    description: 'The page to work on; the page the editor shows when left out.'
  }
}

/** A design tool's input as clients read it: its own, with the document it works on. */
function targetedSchema(tool: DesignTool): Record<string, unknown> {
  const properties = v.safeParse(v.record(v.string(), v.unknown()), tool.inputSchema.properties)
  const required = v.safeParse(v.array(v.string()), tool.inputSchema.required)
  return {
    ...tool.inputSchema,
    properties: { ...(properties.success ? properties.output : {}), ...TARGET_PROPERTIES },
    required: [...(required.success ? required.output : []), 'document_id']
  }
}

/**
 * Registers Core's design tools, as far as the token's scopes go. The server holds no editor:
 * each call goes to an editor tab where the person who connected the app has the document open,
 * which runs it as their own edit, as a local MCP server's calls run in the app.
 */
export function registerDesignTools(server: McpServer, caller: MCPCaller) {
  for (const tool of DESIGN_TOOLS) {
    const scope = tool.mutates ? 'documents:write' : 'documents:read'
    if (!scopesAllow(caller.scopes, scope)) continue
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonToolInput(tool.name, targetedSchema(tool)),
        annotations: { readOnlyHint: tool.readOnly, openWorldHint: false }
      },
      async (args) => {
        const { document_id: documentId, ...toolArgs } = args
        if (typeof documentId !== 'string') return errorResult('Name the document_id to work on.')
        return answering(async () => {
          const outcome = await caller.api.documentTools[tool.mutates ? 'write' : 'read']({
            params: { documentId },
            body: { name: tool.name, args: toolArgs }
          })
          if (outcome.ok) return designToolResult(outcome.result)
          if (outcome.failure === 'editor_not_open') {
            return errorResult(
              `Design tools run in OpenPencil, in an editor where you have the document open, and none has it open now. Ask the person to open ${documentLink(caller, documentId)} and keep it open, then call again.`
            )
          }
          if (outcome.failure === 'tool_failed') {
            return errorResult(outcome.message ?? `${tool.name} failed.`)
          }
          return errorResult(
            `The editor did not answer ${tool.name} in time. Try a smaller change, or check that OpenPencil is still open.`
          )
        })
      }
    )
  }
}
