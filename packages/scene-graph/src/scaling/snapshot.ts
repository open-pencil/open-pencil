import { placeScaledAbout, selectionPlacement, type SelectionPlacement } from '../coordinate'
import type { SceneGraph } from '../graph'
import type { Vector } from '../primitives'
import type { SceneNode } from '../types'
import { rescaleNodeChanges, rescaleTargets } from './tree'

/**
 * The layers a Scale edit changes, as they were when it began, so every step of a drag or a
 * scrubbed field scales from the same start rather than from its own last preview.
 */
export interface ScaleSnapshot {
  /** Each scaled root's place in its parent and on the canvas, by ID. */
  roots: Map<string, SelectionPlacement>
  /** Every layer the edit changes, roots first; locked layers inside are left out. */
  nodes: Map<string, SceneNode>
}

/** Records the roots and the layers inside them that Figma's Scale tool changes. */
export function snapshotScale(graph: SceneGraph, roots: readonly SceneNode[]): ScaleSnapshot {
  const snapshot: ScaleSnapshot = { roots: new Map(), nodes: new Map() }
  for (const root of roots) {
    snapshot.roots.set(root.id, selectionPlacement(root, graph))
    for (const node of rescaleTargets(graph, root, { keepLocked: true }))
      snapshot.nodes.set(node.id, { ...node })
  }
  return snapshot
}

/**
 * What scaling the snapshot evenly by `scale` about a canvas point writes to each layer: its
 * lengths, and for a root its place, so the point stays put and the root keeps its angle.
 */
export function scaledSnapshotChanges(
  graph: SceneGraph,
  snapshot: ScaleSnapshot,
  scale: number,
  anchor: Vector
): Map<string, Partial<SceneNode>> {
  const changes = new Map<string, Partial<SceneNode>>()
  for (const [id, node] of snapshot.nodes) {
    const placement = snapshot.roots.get(id)
    const change = rescaleNodeChanges(graph, node, scale, placement !== undefined)
    // At its own size, a root takes back exactly the place it started from.
    if (placement) {
      const { x, y } = scale === 1 ? node : placeScaledAbout(placement, anchor, scale)
      Object.assign(change, { x, y })
    }
    changes.set(id, change)
  }
  return changes
}
