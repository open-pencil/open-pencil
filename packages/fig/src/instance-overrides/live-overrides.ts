import { findInstanceAncestor } from '@open-pencil/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'

/**
 * True when `nodeId`'s `field` was recorded as a live instance override
 * (via recordInstanceOverride) — i.e. the field was edited after the file
 * was last imported/saved. Lazy-population resync (re-cloning instance
 * children, reapplying the stored symbol overrides) must not clobber these,
 * since the stored data predates the edit.
 */
export function hasLiveOverride(graph: SceneGraph, nodeId: string, field: string): boolean {
  const instance = findInstanceAncestor(graph, nodeId)
  if (!instance) return false
  const key = nodeId === instance.id ? field : `${nodeId}:${field}`
  return key in instance.overrides
}
