/**
 * Adapter: tool definitions → Vercel AI SDK `tool()` objects.
 *
 * Converts ParamDef types to valibot schemas and wraps execute
 * functions with FigmaAPI instantiation.
 */

import type { FigmaAPI } from '../figma-api'
import type { ToolDef, ParamDef, ParamType } from './schema'
import type * as valibot from 'valibot'

export interface ToolLogEntry {
  tool: string
  args: Record<string, unknown>
  result: unknown
  error?: string
  timestamp: number
  durationMs: number
  mutates: boolean
  /** For mutating tools: snapshot of target node props before execution */
  nodeBefore?: Record<string, unknown>
  /** For mutating tools: snapshot of target node props after execution */
  nodeAfter?: Record<string, unknown>
  /** Props that didn't change despite the tool reporting success */
  unchangedProps?: string[]
  /** True when this exact tool+args combo was already called in the session */
  isDuplicate?: boolean
}

export interface ToolDebugLog {
  entries: ToolLogEntry[]
  /** Detect repeated tool calls with identical args */
  duplicates: Array<{ tool: string; args: Record<string, unknown>; count: number }>
  /** Entries where mutating tool succeeded but node didn't change */
  noopMutations: ToolLogEntry[]
  /** Total bytes of tool results sent to model (rough token proxy) */
  totalResultBytes: number
}

export interface StepBudget {
  current: number
  max: number
}

export interface AIAdapterOptions {
  getFigma: () => FigmaAPI
  onBeforeExecute?: (def: ToolDef) => void
  onAfterExecute?: (def: ToolDef) => Promise<void> | void
  onFlashNodes?: (nodeIds: string[]) => void
  onToolLog?: (entry: ToolLogEntry) => void
  getStepBudget?: () => StepBudget
}

const STEP_WARNING_THRESHOLD = 5

function appendStepWarning(result: unknown, budget: StepBudget): unknown {
  const remaining = budget.max - budget.current
  if (remaining > STEP_WARNING_THRESHOLD) return result
  const warning = `⚠ ${remaining} steps remaining out of ${budget.max}. Wrap up: finish critical fixes, skip polish. User can send "continue" for more steps.`
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...result, _warning: warning }
  }
  return { result, _warning: warning }
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

function captureNodeSnapshot(
  figma: FigmaAPI,
  args: Record<string, unknown>
): Record<string, unknown> | undefined {
  const targetId = args.id as string | undefined
  if (!targetId) return undefined
  const raw = figma.graph.getNode(targetId)
  if (!raw) return undefined
  return structuredClone(raw) as unknown as Record<string, unknown>
}

function emitToolLog(
  options: AIAdapterOptions,
  def: ToolDef,
  args: Record<string, unknown>,
  startTime: number,
  figma: FigmaAPI,
  nodeBefore: Record<string, unknown> | undefined,
  execResult: unknown,
  error?: string
): void {
  if (!options.onToolLog) return

  let nodeAfter: Record<string, unknown> | undefined
  let unchangedProps: string[] | undefined

  if (def.mutates && !error) {
    nodeAfter = captureNodeSnapshot(figma, args)
    if (nodeBefore && nodeAfter) {
      unchangedProps = detectUnchangedProps(def.name, args, nodeBefore, nodeAfter)
    }
  }

  options.onToolLog({
    tool: def.name,
    args,
    result: execResult,
    error,
    timestamp: startTime,
    durationMs: Date.now() - startTime,
    mutates: !!def.mutates,
    nodeBefore,
    nodeAfter,
    unchangedProps: unchangedProps?.length ? unchangedProps : undefined
  })
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
        const startTime = Date.now()
        const figma = options.getFigma()
        const nodeBefore =
          def.mutates && options.onToolLog ? captureNodeSnapshot(figma, args) : undefined

        options.onBeforeExecute?.(def)
        try {
          let execResult = await def.execute(options.getFigma(), args)
          if (def.mutates && options.onFlashNodes) {
            const ids = extractNodeIds(execResult)
            if (ids.length > 0) options.onFlashNodes(ids)
          }
          emitToolLog(options, def, args, startTime, figma, nodeBefore, execResult)
          if (options.getStepBudget) {
            execResult = appendStepWarning(execResult, options.getStepBudget())
          }
          return execResult
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          emitToolLog(options, def, args, startTime, figma, nodeBefore, null, errorMsg)
          return { error: errorMsg }
        } finally {
          await options.onAfterExecute?.(def)
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

/**
 * Map from tool arg names to the SceneNode property they affect.
 * Only needed where the arg name differs from the node prop name.
 */
const ARG_TO_NODE_PROP: Record<string, string> = {
  color: 'fills',
  corner_radius: 'cornerRadius',
  font_size: 'fontSize',
  font_weight: 'fontWeight',
  text: 'text',
  visible: 'visible',
  opacity: 'opacity',
  direction: 'layoutMode',
  spacing: 'itemSpacing',
  name: 'name',
  rotation: 'rotation',
  value: 'opacity',
  mode: 'blendMode'
}

/** Args that are parameters to the tool, not node properties to track */
const SKIP_ARGS: Partial<Record<string, Set<string>>> = {
  set_effects: new Set(['type', 'color', 'offset_x', 'offset_y', 'radius', 'spread']),
  set_fill: new Set(['type', 'color']),
  set_stroke: new Set(['type', 'color']),
  set_layout: new Set(['align', 'counter_align', 'padding', 'padding_horizontal', 'padding_vertical']),
}

function detectUnchangedProps(
  toolName: string,
  args: Record<string, unknown>,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  const skipSet = SKIP_ARGS[toolName]
  const unchanged: string[] = []
  for (const [argKey, argVal] of Object.entries(args)) {
    if (argKey === 'id' || argVal === undefined) continue
    if (skipSet?.has(argKey)) continue
    const nodeProp = ARG_TO_NODE_PROP[argKey] ?? argKey
    const beforeVal = before[nodeProp]
    const afterVal = after[nodeProp]
    if (beforeVal !== undefined && afterVal !== undefined) {
      const bStr = JSON.stringify(beforeVal)
      const aStr = JSON.stringify(afterVal)
      if (bStr === aStr) {
        unchanged.push(nodeProp)
      }
    }
  }
  return unchanged
}

export function buildDebugLog(entries: ToolLogEntry[]): ToolDebugLog {
  const callCounts = new Map<
    string,
    { args: Record<string, unknown>; count: number; mutates: boolean }
  >()
  const noopMutations: ToolLogEntry[] = []
  let totalResultBytes = 0

  for (const entry of entries) {
    totalResultBytes += JSON.stringify(entry.result ?? '').length

    const key = `${entry.tool}:${JSON.stringify(entry.args)}`
    const existing = callCounts.get(key)
    if (existing) {
      existing.count++
      if (entry.mutates) entry.isDuplicate = true
    } else {
      callCounts.set(key, { args: entry.args, count: 1, mutates: entry.mutates })
    }

    if (entry.mutates && !entry.error && entry.unchangedProps?.length) {
      noopMutations.push(entry)
    }
  }

  const duplicates: ToolDebugLog['duplicates'] = []
  for (const [key, { args, count, mutates }] of callCounts) {
    if (count > 1 && mutates) {
      const tool = key.split(':')[0]
      duplicates.push({ tool, args, count })
    }
  }

  return { entries, duplicates, noopMutations, totalResultBytes }
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
