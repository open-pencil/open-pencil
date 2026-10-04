import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

import type { LintFix, LintMessage } from './types'

/** A fix for the layer it was reported on. A `LintMessage` with a `fix` is one. */
export interface LintFixRequest {
  nodeId: string
  fix: LintFix
}

/**
 * Where fixes are written. The editor supplies undoable actions; headless callers write the
 * graph directly with {@link graphFixTarget}.
 */
export interface LintFixTarget {
  readonly graph: SceneGraph
  updateNode(nodeId: string, changes: Partial<SceneNode>): void
  bindVariable(nodeId: string, path: string, variableId: string): void
}

export function graphFixTarget(graph: SceneGraph): LintFixTarget {
  return {
    graph,
    updateNode: (nodeId, changes) => graph.updateNode(nodeId, changes),
    bindVariable: (nodeId, path, variableId) => graph.bindVariable(nodeId, path, variableId)
  }
}

/** The safe fixes of a lint run, which apply together without review. */
export function safeFixes(messages: readonly LintMessage[]): LintFixRequest[] {
  return messages.flatMap(({ nodeId, fix }) => (fix ? [{ nodeId, fix }] : []))
}

const PAINT_PATH = /^(fills|strokes)\/(\d+)\/color$/

/**
 * Binding is safe only while the paint still shows the variable's color: a paint edited since
 * the lint run would change appearance, so its fix is skipped.
 */
function canBind(graph: SceneGraph, node: SceneNode, path: string, variableId: string): boolean {
  if (node.boundVariables[path] === variableId) return false
  const match = PAINT_PATH.exec(path)
  if (!match) return false
  const index = Number(match[2])
  const paint = match[1] === 'fills' ? node.fills.at(index) : node.strokes.at(index)
  const color = graph.resolveColorVariableForNode(node.id, variableId)
  if (!paint || !color || ('type' in paint && paint.type !== 'SOLID')) return false
  return colorToHex({ ...paint.color, a: 1 }) === colorToHex({ ...color, a: 1 })
}

/**
 * Applies fixes that still hold against the current graph. Changes to one layer merge into a
 * single update. Returns the number of fixes applied.
 */
export function applyLintFixes(target: LintFixTarget, requests: readonly LintFixRequest[]): number {
  const { graph } = target
  const updates = new Map<string, Partial<SceneNode>>()
  let applied = 0
  for (const { nodeId, fix } of requests) {
    const node = graph.getNode(nodeId)
    if (!node) continue
    if (fix.kind === 'bind-variable') {
      if (!canBind(graph, node, fix.path, fix.variableId)) continue
      target.bindVariable(nodeId, fix.path, fix.variableId)
      applied++
      continue
    }
    const changes = Object.fromEntries(
      Object.entries(fix.changes).filter(([key, value]) => Reflect.get(node, key) !== value)
    )
    if (Object.keys(changes).length === 0) continue
    updates.set(nodeId, { ...updates.get(nodeId), ...changes })
    applied++
  }
  for (const [nodeId, changes] of updates) target.updateNode(nodeId, changes)
  return applied
}
