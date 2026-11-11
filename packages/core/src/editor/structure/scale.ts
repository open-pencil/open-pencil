import { isEqual, pick } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  MIN_RESCALE,
  scaledSnapshotChanges,
  scaleRoots,
  snapshotScale
} from '@open-pencil/scene-graph/scaling'

import type { EditorContext } from '#core/editor/types'

/** One layer's fields a Scale edit changed: as they were, and as it left them. */
interface ScaledFields {
  id: string
  before: Partial<SceneNode>
  after: Partial<SceneNode>
}

/**
 * Scales the layers evenly about a canvas point as one undo step, as Figma's Scale tool does: text
 * sizes, strokes, effects, radii, spacing, and geometry scale with them, each keeps its angle, and
 * the point stays put. Locked layers inside them keep their size and place in their parent. Undo
 * puts back only the fields it changed, so the selection and others' edits to the same layers
 * stay.
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
  const fields: ScaledFields[] = [...changes].flatMap(([id, after]) => {
    const node = ctx.graph.getNode(id)
    if (!node) return []
    // Only the fields the scale changes, so undo leaves others' edits to the rest alone.
    const keys = (Object.keys(after) as (keyof SceneNode)[]).filter(
      (key) => !isEqual(node[key], after[key])
    )
    if (keys.length === 0) return []
    return [{ id, before: structuredClone(pick(node, keys)), after: pick(after, keys) }]
  })
  const apply = (side: 'before' | 'after') => {
    for (const field of fields) {
      if (ctx.graph.getNode(field.id)) ctx.graph.updateNode(field.id, structuredClone(field[side]))
    }
    for (const root of roots) {
      if (ctx.graph.getNode(root.id)) ctx.runLayoutForNode(root.id)
    }
    ctx.requestRender()
  }
  apply('after')
  ctx.undo.push({ label: 'Scale', forward: () => apply('after'), inverse: () => apply('before') })
}
