import { resolve } from 'node:path'

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { ALL_TOOLS, CODEGEN_PROMPT } from '@open-pencil/core/tools'

import { fail, ok } from '#mcp/result'

import { resolveSafePath, writeToolOutput } from './output'
import { paramToZod } from './schema'

export type RpcSender = (body: Record<string, unknown>) => Promise<unknown>

export interface RegisterToolsOptions {
  enableEval: boolean
  mcpRoot?: string | null
  sendRpc: RpcSender
}

export function registerTools(mcpServer: McpServer, options: RegisterToolsOptions) {
  const { enableEval, sendRpc } = options
  const resolvedRoot = options.mcpRoot ? resolve(options.mcpRoot) : null
  const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

  for (const def of ALL_TOOLS) {
    if (!enableEval && def.name === 'eval') continue
    const shape: Record<string, z.ZodType> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }
    register(
      def.name,
      { description: def.description, inputSchema: z.object(shape) },
      async (args: Record<string, unknown>) => {
        try {
          const result = await sendRpc({ command: 'tool', args: { name: def.name, args } })
          const res = result as { ok?: boolean; result?: unknown; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          const r = res.result as Record<string, unknown> | undefined
          const filePath = typeof args.path === 'string' ? args.path : null
          if (r && filePath && resolvedRoot) {
            const written = await writeToolOutput(def.name, r, filePath, resolvedRoot)
            if (written) return written
          }
          if (r && 'base64' in r && 'mimeType' in r) {
            return {
              content: [
                {
                  type: 'image' as const,
                  data: r.base64 as string,
                  mimeType: r.mimeType as string
                }
              ]
            }
          }
          return ok(r)
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'save_file',
    {
      description:
        'Save the current document to disk. Uses the existing file path if available, otherwise prompts for a location.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        const result = await sendRpc({ command: 'save_file' })
        const res = result as { ok?: boolean; error?: string }
        if (res.ok === false) return fail(new Error(res.error))
        return ok({ saved: true })
      } catch (e) {
        return fail(e)
      }
    }
  )

  if (resolvedRoot) {
    register(
      'open_file',
      {
        description: `Open a .fig or .pen file from disk into a new tab. Path must be inside ${resolvedRoot}.`,
        inputSchema: z.object({
          path: z.string().describe('Absolute path to the design file')
        })
      },
      async (args: { path: string }) => {
        try {
          const safe = resolveSafePath(args.path, resolvedRoot)
          const result = await sendRpc({ command: 'open_file', args: { path: safe } })
          const res = result as { ok?: boolean; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          return ok({ opened: true })
        } catch (e) {
          return fail(e)
        }
      }
    )

    register(
      'new_document',
      {
        description: `Create a new empty document. Optionally set a save path inside ${resolvedRoot}.`,
        inputSchema: z.object({
          path: z.string().describe('Optional absolute path for the new file').optional()
        })
      },
      async (args: { path?: string }) => {
        try {
          const safePath = args.path ? resolveSafePath(args.path, resolvedRoot) : undefined
          const result = await sendRpc({ command: 'new_document', args: { path: safePath } })
          const res = result as { ok?: boolean; error?: string }
          if (res.ok === false) return fail(new Error(res.error))
          return ok({ created: true })
        } catch (e) {
          return fail(e)
        }
      }
    )
  }

  register(
    'get_codegen_prompt',
    {
      description:
        'Get design-to-code generation guidelines. Call before generating frontend code.',
      inputSchema: z.object({})
    },
    async () => ok({ prompt: CODEGEN_PROMPT })
  )
}
