/**
 * Adapter: tool definitions → Vercel AI SDK `tool()` objects.
 *
 * Converts ParamDef types to valibot schemas and wraps execute
 * functions with FigmaAPI instantiation.
 */

import type { FigmaAPI } from '../figma-api'
import type { ToolDef, ParamDef, ParamType } from './schema'
import type * as valibot from 'valibot'

export interface AIAdapterOptions {
  getFigma: () => FigmaAPI
  onBeforeExecute?: (def: ToolDef) => void
  onAfterExecute?: (def: ToolDef) => void
  onFlashNodes?: (nodeIds: string[]) => void
}

function extractIdsFromArray(arr: unknown[]): string[] {
  const ids: string[] = []
  for (const item of arr) {
    if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
      ids.push(item.id)
    }
  }
  return ids
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  if ('deleted' in result && typeof result.deleted === 'string') return []
  const ids: string[] = []
  if ('id' in result && typeof result.id === 'string') ids.push(result.id)
  if ('selection' in result && Array.isArray(result.selection)) ids.push(...extractIdsFromArray(result.selection))
  if ('results' in result && Array.isArray(result.results)) ids.push(...extractIdsFromArray(result.results))
  return ids
}

export function toolsToAI(
  tools: ToolDef[],
  options: AIAdapterOptions,
  deps: {
    v: typeof valibot
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- valibot schema type erasure at adapter boundary
    valibotSchema: (schema: any) => unknown
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- Vercel AI tool() has complex overloads that can't be expressed without any
    tool: (...args: any[]) => unknown
  }
// eslint-disable-next-line typescript-eslint/no-explicit-any -- return type must be any to satisfy Vercel AI SDK's ToolSet which uses any internally
): Record<string, any> {
  const { v, valibotSchema, tool } = deps
  // eslint-disable-next-line typescript-eslint/no-explicit-any -- matches return type
  const result: Record<string, any> = {}

  for (const def of tools) {
    const shape: Record<string, unknown> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToValibot(v, param)
    }

    const toolOpts: Record<string, unknown> = {
      description: def.description,
      // eslint-disable-next-line typescript-eslint/no-explicit-any -- valibot v.object() requires typed ObjectEntries, but shape is built dynamically
      inputSchema: valibotSchema(v.object(shape as Record<string, any>)),
      execute: async (args: Record<string, unknown>) => {
        options.onBeforeExecute?.(def)
        try {
          const execResult = await def.execute(options.getFigma(), args)
          if (def.mutates && options.onFlashNodes) {
            const ids = extractNodeIds(execResult)
            if (ids.length > 0) options.onFlashNodes(ids)
          }
          return execResult
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        } finally {
          options.onAfterExecute?.(def)
        }
      }
    }

    if (def.name === 'export_image') {
      toolOpts.toModelOutput = ({ output }: { output: unknown }) => {
        if (output && typeof output === 'object' && 'base64' in output && 'mimeType' in output) {
          const r = output as { base64: string; mimeType: string }
          return {
            type: 'content' as const,
            value: [{ type: 'media' as const, mediaType: r.mimeType, data: r.base64 }]
          }
        }
        return { type: 'json' as const, value: output as Record<string, unknown> }
      }
    }

    result[def.name] = tool(toolOpts)
  }

  return result
}

function paramToValibot(v: typeof valibot, param: ParamDef): unknown {
  const typeMap: Record<ParamType, () => unknown> = {
    string: () => (param.enum ? v.picklist(param.enum as [string, ...string[]]) : v.string()),
    number: () => {
      const pipes: unknown[] = [v.number()]
      if (param.min !== undefined) pipes.push(v.minValue(param.min))
      if (param.max !== undefined) pipes.push(v.maxValue(param.max))
      // eslint-disable-next-line typescript-eslint/no-explicit-any -- valibot pipe() requires specific tuple types, but pipes are built dynamically
      return pipes.length > 1 ? v.pipe(...(pipes as [any, any, ...unknown[]])) : v.number()
    },
    boolean: () => v.boolean(),
    color: () => v.pipe(v.string(), v.description('Color value (hex like #ff0000 or #ff000080)')),
    'string[]': () => v.pipe(v.array(v.string()), v.minLength(1))
  }

  let schema = typeMap[param.type]()

  if (param.description && param.type !== 'color') {
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- valibot pipe() requires BaseSchema, but schema is dynamically typed
    schema = v.pipe(schema as any, v.description(param.description))
  }

  if (!param.required) {
    // eslint-disable-next-line typescript-eslint/no-explicit-any -- valibot optional() requires BaseSchema; default value type is dynamic
    schema = v.optional(schema as any, param.default as any)
  }

  return schema
}
