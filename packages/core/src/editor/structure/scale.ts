import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  MIN_RESCALE,
  scaledSnapshotChanges,
  scaleRoots,
  snapshotScale
} from '@open-pencil/scene-graph/scaling'

import { recordSubtreeEdit } from '#core/editor/components/slots/history'
import type { EditorContext } from '#core/editor/types'

/**
 * Scales the layers evenly about a canvas point as one undo step, as Figma's Scale tool does: text
 * sizes, strokes, effects, radii, spacing, and geometry scale with them, each keeps its angle, and
 * the point stays put. Locked layers inside them keep their size and place in their parent.
 */
export function scaleLayers(
  ctx: EditorContext,
  nodes: readonly SceneNode[],
  scale: number,
  anchor: Vector
): void {
  if (!Number.isFinite(scale) || scale < MIN_RESCALE || scale === 1) return
  const roots = scaleRoots(ctx.graph, nodes)
  if (roots.length === 0) return
  const changes = scaledSnapshotChanges(ctx.graph, snapshotScale(ctx.graph, roots), scale, anchor)
  recordSubtreeEdit(
    ctx,
    'Scale',
    roots.map((node) => node.id),
    () => {
      for (const [id, change] of changes) ctx.graph.updateNode(id, change)
    }
  )
}
