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
import { isFixedSizeText, measuredFixedTextReach } from '#core/layout/text-auto-resize'

/** One layer's fields a Scale edit changed: as they were, and as it left them. */
interface ScaledFields {
  id: string
  before: Partial<SceneNode>
  after: Partial<SceneNode>
}

/** How far a fixed-size text's lines reach on each side of a scale. */
type Reach = Record<'before' | 'after', number | null>

/**
 * Sets a fixed-size text's line reach for one side of a scale: measured in its fonts when they can
 * be, else the reach recorded for that side, or, when someone changed it since, the current reach
 * scaled by `ratio`.
 */
function placeReach(
  ctx: EditorContext,
  id: string,
  reach: Reach,
  side: keyof Reach,
  ratio: number
): void {
  const node = ctx.graph.getNode(id)
  if (!node) return
  const opposite = side === 'after' ? 'before' : 'after'
  const current = node.derivedTextHeight
  const rescaled = current === null ? null : current * ratio
  const next =
    measuredFixedTextReach(node) ?? (current === reach[opposite] ? reach[side] : rescaled)
  if (next !== current) ctx.graph.updateNode(id, { derivedTextHeight: next })
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
  // The reach is measured after layout sets each text's width, so it is placed apart from the rest.
  const reaches = new Map<string, Reach>()
  for (const [id, after] of changes) {
    const node = ctx.graph.getNode(id)
    if (node && isFixedSizeText(node)) {
      reaches.set(id, { before: node.derivedTextHeight, after: after.derivedTextHeight ?? null })
    }
  }
  const fields: ScaledFields[] = [...changes].flatMap(([id, after]) => {
    const node = ctx.graph.getNode(id)
    if (!node) return []
    // Only the fields the scale changes, so undo leaves others' edits to the rest alone.
    const keys = (Object.keys(after) as (keyof SceneNode)[]).filter(
      (key) => !(key === 'derivedTextHeight' && reaches.has(id)) && !isEqual(node[key], after[key])
    )
    if (keys.length === 0) return []
    return [{ id, before: structuredClone(pick(node, keys)), after: pick(after, keys) }]
  })
  const apply = (side: keyof Reach) => {
    for (const field of fields) {
      if (ctx.graph.getNode(field.id)) ctx.graph.updateNode(field.id, structuredClone(field[side]))
    }
    for (const root of roots) {
      if (ctx.graph.getNode(root.id)) ctx.runLayoutForNode(root.id)
    }
    const ratio = side === 'after' ? scale : 1 / scale
    for (const [id, reach] of reaches) placeReach(ctx, id, reach, side, ratio)
    ctx.requestRender()
  }
  apply('after')
  // Undo and redo without fonts put back the reach the scale left, measured or not.
  for (const [id, reach] of reaches) reach.after = ctx.graph.getNode(id)?.derivedTextHeight ?? null
  ctx.undo.push({ label: 'Scale', forward: () => apply('after'), inverse: () => apply('before') })
}
