/**
 * Adapter: tool definitions → Vercel AI SDK `tool()` objects.
 *
 * Converts ParamDef types to valibot schemas and wraps execute
 * functions with FigmaAPI instantiation.
 */

import type { FigmaAPI } from '../figma-api'
import type { ToolDef, ParamDef, ParamType } from './schema'

export interface AIAdapterOptions {
  getFigma: () => FigmaAPI
  onBeforeExecute?: () => void
  onAfterExecute?: () => void
  onFlashNodes?: (nodeIds: string[]) => void
}

function extractIdsFromArray(arr: unknown[]): string[] {
  const ids: string[] = []
  for (const item of arr) {
    if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string') {
      ids.push((item as Record<string, unknown>).id as string)
    }
  }
  return ids
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as Record<string, unknown>
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.selection)) ids.push(...extractIdsFromArray(obj.selection))
  if (Array.isArray(obj.results)) ids.push(...extractIdsFromArray(obj.results))
  return ids
}

export function toolsToAI(
  tools: ToolDef[],
  options: AIAdapterOptions,
  deps: {
    v: typeof import('valibot')
    valibotSchema: (schema: any) => any
    tool: (opts: any) => any
  }
): Record<string, any> {
  const { v, valibotSchema, tool } = deps
  const result: Record<string, any> = {}

  for (const def of tools) {
    const shape: Record<string, unknown> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToValibot(v, param)
    }

    result[def.name] = tool({
      description: def.description,
      inputSchema: valibotSchema(v.object(shape as any)),
      execute: async (args: Record<string, unknown>) => {
        options.onBeforeExecute?.()
        try {
          const execResult = await def.execute(options.getFigma(), args as any)
          if (def.mutates && options.onFlashNodes) {
            const ids = extractNodeIds(execResult)
            if (ids.length > 0) options.onFlashNodes(ids)
          }
          return execResult
        } finally {
          options.onAfterExecute?.()
        }
      }
    })
  }

  return result
}

function paramToValibot(v: typeof import('valibot'), param: ParamDef): unknown {
  const typeMap: Record<ParamType, () => unknown> = {
    string: () => (param.enum ? v.picklist(param.enum as [string, ...string[]]) : v.string()),
    number: () => {
      const pipes: unknown[] = [v.number()]
      if (param.min !== undefined) pipes.push(v.minValue(param.min))
      if (param.max !== undefined) pipes.push(v.maxValue(param.max))
      return pipes.length > 1 ? v.pipe(...(pipes as [any, any, ...any[]])) : v.number()
    },
    boolean: () => v.boolean(),
    color: () => v.pipe(v.string(), v.description('Color value (hex like #ff0000 or #ff000080)')),
    'string[]': () => v.pipe(v.array(v.string()), v.minLength(1))
  }

  let schema = typeMap[param.type]()

  if (param.description && param.type !== 'color') {
    schema = v.pipe(schema as any, v.description(param.description))
  }

  if (!param.required) {
    schema = v.optional(schema as any, param.default as any)
  }

  return schema
}
