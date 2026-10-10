/**
 * Tool definition schema.
 *
 * Native Valibot inputs and execution capabilities are owned by each tool.
 * Adapters consume these contracts rather than maintaining transport-specific schemas.
 */

import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api'

export type ToolCapability =
  | 'document:read'
  | 'document:write'
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:access'
  | 'code:execute'
  | 'settings:read'
  | 'settings:write'

export type ToolExecution =
  | { kind: 'sync'; mutation: 'none' | 'view' | 'properties' | 'document' }
  | { kind: 'async'; mutation: 'none' | 'view' | 'document' }

export type ToolInterface = 'mcp' | 'ai' | 'webmcp'
export type ToolExposure = Partial<Record<ToolInterface, boolean>>

interface ToolMetadata {
  name: string
  description: string
  execution: ToolExecution
  /** Interface inclusion defaults to true; execution support and user permissions remain separate. */
  exposure: ToolExposure
  capabilities: readonly ToolCapability[]
  availability: 'default' | 'eval'
}

export interface ToolDef extends ToolMetadata {
  input: v.StrictObjectSchema<v.ObjectEntries, undefined>
  /** Derived from execution metadata, never declared independently by a tool. */
  readonly mutates: boolean
  execute: (figma: FigmaAPI, args: Record<string, unknown>) => unknown
}

type ToolDefinitionMetadata = Omit<ToolMetadata, 'exposure' | 'capabilities' | 'availability'> &
  Partial<Pick<ToolMetadata, 'exposure' | 'capabilities' | 'availability'>>

export function defineTool<P extends v.ObjectEntries, R>(
  def: ToolDefinitionMetadata & {
    input: v.StrictObjectSchema<P, undefined>
    execution: ToolExecution & (R extends PromiseLike<unknown> ? { kind: 'async' } : unknown)
    execute: (figma: FigmaAPI, args: v.InferOutput<v.StrictObjectSchema<P, undefined>>) => R
  }
): ToolDef {
  return {
    ...def,
    exposure: def.exposure ?? {},
    capabilities: def.capabilities ?? [
      toolChangesDocument(def) ? 'document:write' : 'document:read'
    ],
    availability: def.availability ?? 'default',
    get mutates() {
      return def.execution.mutation !== 'none'
    },
    execute: (figma, args) => def.execute(figma, parseToolArgs(def.name, def.input, args))
  }
}

/**
 * Every tool run goes through here, so a wrong call from AI chat, the CLI, or WebMCP names the
 * tool and lists each problem with its argument, as `v.summarize` formats them. MCP clients get
 * the MCP SDK's own report, which validates the same schema before the handler runs. Inputs are
 * strict objects, so a misspelled or mis-nested argument fails here instead of being dropped.
 */
export function parseToolArgs<S extends v.GenericSchema>(
  name: string,
  schema: S,
  args: unknown
): v.InferOutput<S> {
  const result = v.safeParse(schema, args)
  if (result.success) return result.output
  throw new Error(`Invalid arguments for ${name}:\n${v.summarize(result.issues)}`)
}

export function toolChangesDocument(def: Pick<ToolDef, 'execution'>): boolean {
  return def.execution.mutation === 'properties' || def.execution.mutation === 'document'
}

export function isToolExposed(def: Pick<ToolDef, 'exposure'>, target: ToolInterface): boolean {
  return def.exposure[target] !== false
}

export function isAtomicTool(def: ToolDef): boolean {
  return def.execution.kind === 'sync' && def.execution.mutation === 'properties'
}

export class NodeNotFoundError extends Error {
  constructor(id: string) {
    super(`Node not found: ${id}`)
    this.name = 'NodeNotFoundError'
  }
}

export function requireNode(figma: FigmaAPI, id: string): ReturnType<FigmaAPI['getNodeById']> {
  const node = figma.getNodeById(id)
  if (!node) throw new NodeNotFoundError(id)
  return node
}

export function requireNodes(figma: FigmaAPI, ids: ReadonlyArray<string>): FigmaNodeProxy[] | null {
  const nodes: FigmaNodeProxy[] = []
  for (const id of ids) {
    const node = figma.getNodeById(id)
    if (!node) return null
    nodes.push(node)
  }
  return nodes
}

/** A tool's answer when the operation it wraps throws: the error's message for the caller. */
export function toolFailure(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) }
}

export function nodeNotFound(id: string): { error: string } {
  return { error: `Node "${id}" not found` }
}

export function getRawNodeOrError(
  figma: FigmaAPI,
  id: string
): { node: SceneNode } | { error: string } {
  const node = figma.graph.getNode(id)
  return node ? { node } : nodeNotFound(id)
}

export function nodeToResult(node: FigmaNodeProxy, maxDepth?: number): Record<string, unknown> {
  return node.toJSON(maxDepth)
}

export function nodeSummary(node: FigmaNodeProxy): { id: string; name: string; type: string } {
  return { id: node.id, name: node.name, type: node.type }
}
