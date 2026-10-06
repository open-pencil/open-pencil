import {
  createSceneMutationImpact,
  recordSceneMutations,
  type SceneGraph,
  type SceneMutationImpact
} from '@open-pencil/scene-graph'

import { createLayoutRunner } from '#core/layout/mutations'

interface PendingLayout {
  impact: SceneMutationImpact
  flushing: boolean
}

const pendingByGraph = new WeakMap<SceneGraph, PendingLayout>()

function clearImpact(impact: SceneMutationImpact): void {
  for (const ids of Object.values(impact)) ids.clear()
}

/**
 * Records the graph's edits so that reading geometry lays out what they touched first, as Figma
 * does: a script that fills a child and then reads its width sees the filled width. A graph has
 * one recorder for its lifetime; a new API starts it afresh, because the editor lays out its own
 * edits.
 */
export function startPendingLayout(graph: SceneGraph): void {
  const existing = pendingByGraph.get(graph)
  if (existing) {
    clearImpact(existing.impact)
    return
  }
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
  } finally {
    pending.flushing = false
  }
}
