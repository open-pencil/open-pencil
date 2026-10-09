import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'

import type { McpServer, ToolCallback, ToolAnnotations } from '@modelcontextprotocol/server'
// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toStandardJsonSchema as toStandardJSONSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'

import { CODEGEN_PROMPT } from '@open-pencil/core/tools'

import type { RPCJSONObject } from '#mcp/json'
import { MAX_RESULT_BYTES, fail, ok, resultTooLargeMessage } from '#mcp/result'
import { createToolDescriptors, getMCPToolDefinitions } from '#mcp/tool/manifest'
import type { ToolDescriptor, ToolEffect, ToolPolicy } from '#mcp/tool/metadata'
import { resolveSafePath, writeToolOutput } from '#mcp/tool/output'
import { isToolEnabled } from '#mcp/tool/policy'
import { SELECTION_SCOPE_FILE_OUTPUT_ERROR } from '#mcp/tool/scope'

export type RPCSender = (body: Record<string, unknown>) => Promise<unknown>

const automationTargetSchema = {
  document_id: v.optional(
    v.pipe(v.string(), v.description('Optional OpenPencil document/tab ID to target'))
  ),
  page_id: v.optional(
    v.pipe(v.string(), v.description('Optional page ID to target within the document'))
  )
}

function splitAutomationTarget(args: Record<string, unknown>): {
  target: { document_id?: string; page_id?: string }
  args: Record<string, unknown>
} {
  const { document_id, page_id, ...rest } = args
  const target: { document_id?: string; page_id?: string } = {}
  if (typeof document_id === 'string') target.document_id = document_id
  if (typeof page_id === 'string') target.page_id = page_id
  return { target, args: rest }
}

type RPCResponse = { ok?: boolean; result?: unknown; target?: unknown; error?: string }

async function sendCommand(
  sendRPC: RPCSender,
  command: string,
  args: Record<string, unknown>
): Promise<RPCResponse> {
  const res = (await sendRPC({ command, args })) as RPCResponse
  if (res.ok === false) throw new Error(res.error)
  return res
}

function withTarget<T extends object>(body: T, res: RPCResponse): T & { target?: unknown } {
  return res.target ? { ...body, target: res.target } : body
}

/** Who sends a session's tool calls: any MCP client, or an ACP or Pi harness chat in the app. */
export const MCP_AGENT_KINDS = ['mcp', 'acp', 'harness'] as const
export type MCPAgentKind = (typeof MCP_AGENT_KINDS)[number]

/** The session tool calls come from, so the app can show the client as an agent at work. */
export interface MCPAgentSession {
  id: string
  kind: MCPAgentKind
}

export interface RegisterToolsOptions {
  policy: ToolPolicy
  mcpRoot?: string | null
  sendRPC: RPCSender
  agentSession?: MCPAgentSession
}

function toolAnnotations(effect: ToolEffect): ToolAnnotations {
  return {
    readOnlyHint: effect === 'read',
    destructiveHint: effect === 'write'
  }
}

function descriptorByName(descriptors: readonly ToolDescriptor[]): Map<string, ToolDescriptor> {
  return new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
}

export function registerTools(mcpServer: McpServer, options: RegisterToolsOptions): void {
  const { policy, sendRPC, agentSession } = options
  // Sent with each tool call: the session, and the client's name once it has introduced itself.
  const agent = () =>
    agentSession
      ? {
          session: agentSession.id,
          kind: agentSession.kind,
          client: mcpServer.server.getClientVersion()?.name
        }
      : undefined
  const resolvedRoot = options.mcpRoot ? resolve(options.mcpRoot) : null
  const descriptors = descriptorByName(createToolDescriptors(resolvedRoot !== null))
  const register = <InputArgs extends v.GenericSchema>(
    name: string,
    toolOptions: { description?: string; inputSchema: InputArgs },
    handler: ToolCallback<ReturnType<typeof toStandardJSONSchema<InputArgs>>>
  ) => {
    const descriptor = descriptors.get(name)
    if (!descriptor) throw new Error(`Missing MCP tool descriptor for "${name}"`)
    if (!isToolEnabled(descriptor, policy)) return
    mcpServer.registerTool(
      name,
      {
        description: toolOptions.description ?? descriptor.description,
        inputSchema: toStandardJSONSchema(toolOptions.inputSchema),
        annotations: toolAnnotations(descriptor.effect),
        _meta: { 'openpencil/capabilities': descriptor.capabilities }
      },
      handler
    )
  }

  for (const def of getMCPToolDefinitions()) {
    register(
      def.name,
      {
        description: def.description,
        inputSchema: v.strictObject({ ...def.input.entries, ...automationTargetSchema })
      },
      async (args: Record<string, unknown>) => {
        try {
          const { target, args: toolArgs } = splitAutomationTarget(args)
          if (policy.scope === 'selection' && toolArgs.path !== undefined) {
            return fail(new Error(SELECTION_SCOPE_FILE_OUTPUT_ERROR))
          }
          const result = await sendRPC({
            command: 'tool',
            args: {
              ...target,
              name: def.name,
              args: toolArgs,
              agent: agent(),
              // A client limited to the selection says so, whatever the server's own scope.
              ...(policy.scope === 'selection' ? { scope: policy.scope } : {})
            }
          })
          const res = result as { ok?: boolean; result?: unknown; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          const r = res.result as RPCJSONObject | undefined
          const filePath = typeof toolArgs.path === 'string' ? toolArgs.path : null
          if (r && filePath && resolvedRoot) {
            const written = await writeToolOutput(def.name, r, filePath, resolvedRoot)
            if (written) return written
          }
          if (r && 'base64' in r && 'mimeType' in r) {
            const base64 = String(r.base64)
            const bytes = Buffer.byteLength(base64, 'utf8')
            if (bytes > MAX_RESULT_BYTES) {
              return fail(
                new Error(
                  resultTooLargeMessage(
                    `Image from "${def.name}"`,
                    bytes,
                    'Export a smaller region or lower the scale/resolution.'
                  )
                )
              )
            }
            return {
              content: [
                {
                  type: 'image' as const,
                  data: base64,
                  mimeType: r.mimeType as string
                }
              ]
            }
          }
          return ok(r, def.name)
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'list_documents',
    {
      description:
        'List open OpenPencil documents/tabs with their IDs, file paths, current pages, and pages.',
      inputSchema: v.strictObject({})
    },
    async () => {
      try {
        const result = await sendRPC({ command: 'list_documents', args: {} })
        const res = result as { ok?: boolean; result?: unknown; error?: string }
        if (res.ok === false) return fail(new Error(res.error))
        return ok(res.result ?? {})
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'save_file',
    {
      description: resolvedRoot
        ? 'Save the current document to disk. If path is provided, it must be inside the configured MCP root.'
        : 'Save the current document to disk. Uses the existing file path if available, otherwise prompts for a location.',
      inputSchema: resolvedRoot
        ? v.strictObject({
            path: v.optional(
              v.pipe(
                v.string(),
                v.minLength(1),
                v.description('Path for the .fig file, absolute or relative to the MCP root')
              )
            ),
            ...automationTargetSchema
          })
        : v.strictObject({ ...automationTargetSchema })
    },
    async (args: { path?: string; document_id?: string; page_id?: string }) => {
      try {
        const safePath =
          args.path !== undefined && resolvedRoot
            ? await resolveSafePath(args.path, resolvedRoot)
            : undefined
        const { target } = splitAutomationTarget(args)
        const result = await sendRPC({
          command: 'save_file',
          args: { ...target, path: safePath?.realPath }
        })
        const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
        if (res.ok === false) return fail(new Error(res.error))
        const response: { saved: true; path?: string; target?: unknown } = { saved: true }
        if (safePath) response.path = safePath.resolved
        if (res.target) response.target = res.target
        return ok(response)
      } catch (e) {
        return fail(e)
      }
    }
  )

  if (resolvedRoot) {
    register(
      'open_file',
      {
        description: 'Open a .fig or .pen file from inside the configured MCP root.',
        inputSchema: v.strictObject({
          path: v.pipe(
            v.string(),
            v.minLength(1),
            v.description('Path to the design file, absolute or relative to the MCP root')
          ),
          ...automationTargetSchema
        })
      },
      async (args: { path: string; document_id?: string; page_id?: string }) => {
        try {
          const safe = await resolveSafePath(args.path, resolvedRoot)
          const { target } = splitAutomationTarget(args)
          const result = await sendRPC({
            command: 'open_file',
            args: { ...target, path: safe.realPath }
          })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          const response: { opened: true; target?: unknown } = { opened: true }
          if (res.target) response.target = res.target
          return ok(response)
        } catch (e) {
          return fail(e)
        }
      }
    )

    register(
      'new_document',
      {
        description:
          'Create a new empty document with an optional save path inside the configured MCP root.',
        inputSchema: v.strictObject({
          path: v.optional(
            v.pipe(
              v.string(),
              v.minLength(1),
              v.description('Path for the new file, absolute or relative to the MCP root')
            )
          ),
          ...automationTargetSchema
        })
      },
      async (args: { path?: string; document_id?: string; page_id?: string }) => {
        try {
          const safePath =
            args.path !== undefined ? await resolveSafePath(args.path, resolvedRoot) : undefined
          const { target } = splitAutomationTarget(args)
          const result = await sendRPC({
            command: 'new_document',
            args: { ...target, path: safePath?.realPath }
          })
          const res = result as { ok?: boolean; result?: unknown; target?: unknown; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          const response: { created: true; target?: unknown } = { created: true }
          if (res.target) response.target = res.target
          return ok(response)
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  const closeEntries = {
    unsaved: v.optional(
      v.pipe(
        v.picklist(['error', 'save', 'discard']),
        v.description(
          'What to do with unsaved changes: "error" (default) fails, "save" saves first, "discard" drops them'
        )
      )
    ),
    ...automationTargetSchema
  }

  register(
    'close_file',
    {
      inputSchema: resolvedRoot
        ? v.strictObject({
            ...closeEntries,
            path: v.optional(
              v.pipe(
                v.string(),
                v.minLength(1),
                v.description(
                  'With unsaved "save": .fig path for a document never saved, inside the MCP root'
                )
              )
            )
          })
        : v.strictObject(closeEntries)
    },
    async (args: {
      unsaved?: 'error' | 'save' | 'discard'
      path?: string
      document_id?: string
      page_id?: string
    }) => {
      try {
        const safePath =
          args.path !== undefined && resolvedRoot
            ? await resolveSafePath(args.path, resolvedRoot)
            : undefined
        const { target } = splitAutomationTarget(args)
        const rpcArgs: Record<string, unknown> = { ...target }
        if (args.unsaved) rpcArgs.unsaved = args.unsaved
        if (safePath) rpcArgs.path = safePath.realPath
        const res = await sendCommand(sendRPC, 'close_file', rpcArgs)
        const closed = (res.result as { closed?: boolean } | undefined)?.closed === true
        return ok(withTarget({ closed }, res))
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'activate_document',
    {
      inputSchema: v.strictObject({
        document_id: v.pipe(v.string(), v.description('Document/tab ID from list_documents')),
        page_id: automationTargetSchema.page_id
      })
    },
    async (args: { document_id: string; page_id?: string }) => {
      try {
        const { target } = splitAutomationTarget(args)
        const res = await sendCommand(sendRPC, 'activate_document', target)
        return ok(withTarget({ activated: true }, res))
      } catch (e) {
        return fail(e)
      }
    }
  )

  for (const command of ['undo', 'redo'] as const) {
    register(
      command,
      { inputSchema: v.strictObject({ ...automationTargetSchema }) },
      async (args) => {
        try {
          const { target } = splitAutomationTarget(args)
          const res = await sendCommand(sendRPC, command, target)
          return ok(withTarget({ ...(res.result as RPCJSONObject | undefined) }, res))
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register('get_settings', { inputSchema: v.strictObject({}) }, async () => {
    try {
      const res = await sendCommand(sendRPC, 'get_settings', {})
      return ok(res.result ?? {})
    } catch (e) {
      return fail(e)
    }
  })

  register(
    'update_settings',
    {
      inputSchema: v.strictObject({
        settings: v.pipe(
          v.record(v.string(), v.unknown()),
          v.description(
            'Partial settings, e.g. {"appearance":{"theme":"light"},"editing":{"snapping":{"pixelGrid":false}}}. Unknown keys and invalid values are rejected.'
          )
        )
      })
    },
    async (args: { settings: Record<string, unknown> }) => {
      try {
        // Echo only the applied patch: with get_settings disabled, writing must not read.
        await sendCommand(sendRPC, 'update_settings', { settings: args.settings })
        return ok({ updated: args.settings })
      } catch (e) {
        return fail(e)
      }
    }
  )

  register(
    'get_codegen_prompt',
    {
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      inputSchema: v.strictObject({})
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )
}
