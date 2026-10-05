/**
 * Adapter: tool definitions → Vercel AI SDK `tool()` objects.
 *
 * Consumes native tool input schemas and wraps execution with FigmaAPI instantiation.
 */

// eslint-disable-next-line open-pencil/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { toStandardJsonSchema as toStandardJSONSchema } from '@valibot/to-json-schema'
import type { JSONValue, ToolResultPart, ToolSet, tool as createTool } from 'ai'

import type { FigmaAPI } from '#core/figma-api'

import { isToolExposed, type ToolDef } from './schema'

export interface ToolLogEntry {
  tool: string
  args: Record<string, unknown>
  result: unknown
  error?: string
  /** What the tool threw, kept for diagnostics; the model gets only `error`. */
  cause?: unknown
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
  executeTool?: (
    def: ToolDef,
    figma: FigmaAPI,
    args: Record<string, unknown>,
    call: { toolCallId: string }
  ) => Promise<unknown>
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
  if ('selection' in result && Array.isArray(result.selection))
    ids.push(...extractIdsFromArray(result.selection))
  if ('results' in result && Array.isArray(result.results))
    ids.push(...extractIdsFromArray(result.results))
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
  return Object.fromEntries(Object.entries(structuredClone(raw)))
}

function emitToolLog(
  options: AIAdapterOptions,
  def: ToolDef,
  args: Record<string, unknown>,
  startTime: number,
  figma: FigmaAPI,
  nodeBefore: Record<string, unknown> | undefined,
  execResult: unknown,
  failure?: { error: string; cause: unknown }
): void {
  if (!options.onToolLog) return

  let nodeAfter: Record<string, unknown> | undefined
  let unchangedProps: string[] | undefined

  if (def.mutates && !failure) {
    nodeAfter = captureNodeSnapshot(figma, args)
    if (nodeBefore && nodeAfter) {
      unchangedProps = detectUnchangedProps(def.name, args, nodeBefore, nodeAfter)
    }
  }

  options.onToolLog({
    tool: def.name,
    args,
    result: execResult,
    error: failure?.error,
    cause: failure?.cause,
    timestamp: startTime,
    durationMs: Date.now() - startTime,
    mutates: !!def.mutates,
    nodeBefore,
    nodeAfter,
    unchangedProps: unchangedProps?.length ? unchangedProps : undefined
  })
}

/** Most tools report a failure by returning `{ error }` rather than throwing. */
function returnedError(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null || !('error' in result)) return undefined
  return typeof result.error === 'string' ? result.error : undefined
}

function isImageOutput(
  output: unknown
): output is { base64: string; mimeType: string; [key: string]: unknown } {
  return (
    typeof output === 'object' &&
    output !== null &&
    'base64' in output &&
    typeof output.base64 === 'string' &&
    'mimeType' in output &&
    typeof output.mimeType === 'string' &&
    output.mimeType.startsWith('image/')
  )
}

export function toolsToAI(
  tools: ToolDef[],
  options: AIAdapterOptions,
  deps: {
    tool: typeof createTool
  }
): ToolSet {
  const { tool } = deps
  const result: ToolSet = {}

  for (const def of tools) {
    if (!isToolExposed(def, 'ai')) continue
    const toolOpts: Record<string, unknown> = {
      description: def.description,
      inputSchema: toStandardJSONSchema(def.input),
      execute: async (args: Record<string, unknown>, { toolCallId }: { toolCallId: string }) => {
        const startTime = Date.now()
        const figma = options.getFigma()
        const nodeBefore =
          def.mutates && options.onToolLog ? captureNodeSnapshot(figma, args) : undefined

        options.onBeforeExecute?.(def)
        try {
          let execResult = options.executeTool
            ? await options.executeTool(def, figma, args, { toolCallId })
            : await def.execute(figma, args)
          if (def.mutates && options.onFlashNodes) {
            const ids = extractNodeIds(execResult)
            if (ids.length > 0) options.onFlashNodes(ids)
          }
          const error = returnedError(execResult)
          emitToolLog(
            options,
            def,
            args,
            startTime,
            figma,
            nodeBefore,
            execResult,
            error === undefined ? undefined : { error, cause: undefined }
          )
          if (options.getStepBudget) {
            execResult = appendStepWarning(execResult, options.getStepBudget())
          }
          return execResult
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          emitToolLog(options, def, args, startTime, figma, nodeBefore, null, {
            error: errorMsg,
            cause: err
          })
          return { error: errorMsg }
        } finally {
          await options.onAfterExecute?.(def)
        }
      }
    }

    // Image results reach the model as files, with their metadata as text. Typed against the
    // SDK, because a shape it does not know fails the next step's prompt validation.
    toolOpts.toModelOutput = ({ output }: { output: unknown }): ToolResultPart['output'] => {
      if (isImageOutput(output)) {
        const { base64, mimeType, ...metadata } = output
        const image = {
          type: 'file' as const,
          mediaType: mimeType,
          data: { type: 'data' as const, data: base64 }
        }
        return Object.keys(metadata).length > 0
          ? {
              type: 'content',
              value: [{ type: 'text', text: JSON.stringify(metadata) }, image]
            }
          : { type: 'content', value: [image] }
      }
      return { type: 'json', value: output as JSONValue }
    }

    result[def.name] = tool(toolOpts as never)
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
  set_layout: new Set([
    'align',
    'counter_align',
    'padding',
    'padding_horizontal',
    'padding_vertical'
  ])
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
