import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createSceneMutationImpact,
  recordSceneMutations,
  type SceneMutationImpact
} from '@open-pencil/scene-graph/mutation-impact'

import { createLayoutRunner } from '#core/layout/mutations'

interface PendingLayout {
  impact: SceneMutationImpact
  flushing: boolean
}

const pendingByGraph = new WeakMap<SceneGraph, PendingLayout>()

function clearImpact(impact: SceneMutationImpact): void {
  for (const ids of Object.values(impact)) ids.clear()
}

function mergeImpact(into: SceneMutationImpact, from: SceneMutationImpact): void {
  for (const key of Object.keys(into) as (keyof SceneMutationImpact)[]) {
    for (const id of from[key]) into[key].add(id)
  }
}

/**
 * Records the graph's edits so that reading geometry lays out what they touched first, as Figma
 * does: a script that fills a child and then reads its width sees the filled width. A graph has
 * one recorder for its lifetime, kept across APIs: a script that failed before its tool laid
 * out its edits leaves them for the next read to lay out.
 */
export function startPendingLayout(graph: SceneGraph): void {
  if (pendingByGraph.has(graph)) return
  const pending: PendingLayout = { impact: createSceneMutationImpact(), flushing: false }
  pendingByGraph.set(graph, pending)
  // Layout's own writes are its result, not new edits.
  recordSceneMutations(graph, pending.impact, () => !pending.flushing && !graph.isApplyingLayout)
}

/** Lays out the edits recorded since the last geometry read. */
export function flushPendingLayout(graph: SceneGraph): void {
  const pending = pendingByGraph.get(graph)
  if (!pending || pending.flushing || pending.impact.changedNodeIds.size === 0) return
  const impact = structuredClone(pending.impact)
  clearImpact(pending.impact)
  pending.flushing = true
  try {
    createLayoutRunner(() => graph).runLayoutForImpact(impact)
  } catch (error) {
    // The edits are still unlaid out, so the next read tries again.
    mergeImpact(pending.impact, impact)
    throw error
  } finally {
    pending.flushing = false
  }
}

/** Whether a frame resizing would move or stretch the layer: a constraint other than left or top. */
function followsFrameSize(node: SceneNode): boolean {
  return node.horizontalConstraint !== 'MIN' || node.verticalConstraint !== 'MIN'
}

/** Whether the recorded edits touched the layer or a layer above it. */
function editsReach(graph: SceneGraph, impact: SceneMutationImpact, node: SceneNode): boolean {
  const touched = (id: string) =>
    impact.changedNodeIds.has(id) ||
    impact.currentParentIds.has(id) ||
    impact.previousParentIds.has(id)
  return graph.closest(node.id, (current) => touched(current.id)) !== undefined
}

/**
 * Lays out the recorded edits before a script moves or sizes `node`, when that layout could change
 * where it lands, as Figma lays out a script's edits while it runs: the layer follows its frame's
 * size, or a resize places its children from its own size. A layer pinned left and top, or one
 * an auto layout places, lands the same either way, so its edits wait for the next read: a script
 * that builds many layers lays out once rather than once per layer.
 */
export function flushPendingLayoutBefore(
  graph: SceneGraph,
  node: SceneNode,
  { placesChildren = false }: { placesChildren?: boolean } = {}
): void {
  const pending = pendingByGraph.get(graph)
  if (!pending || pending.flushing || pending.impact.changedNodeIds.size === 0) return
  const depends =
    followsFrameSize(node) || (placesChildren && graph.getChildren(node.id).some(followsFrameSize))
  if (depends && editsReach(graph, pending.impact, node)) flushPendingLayout(graph)
}
