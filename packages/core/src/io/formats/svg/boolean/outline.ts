import type { SceneNode } from '@open-pencil/scene-graph'

import type { SVGExportContext } from '#core/io/formats/svg/defs'
import { fillOutlines, type FillOutline } from '#core/io/formats/svg/regions'

/** A boolean operation's combined shape as the canvas draws it, none when nothing is left of it. */
export type SVGBooleanOutlines = (node: SceneNode) => FillOutline[]

/**
 * The outlines a boolean operation draws instead of its operands: the combined shape, or its saved
 * fill geometry where nothing can combine one. Null for other layers and without either.
 */
export function booleanOutlines(
  node: SceneNode,
  ctx: Pick<SVGExportContext, 'booleanOutlines'>
): FillOutline[] | null {
  if (node.type !== 'BOOLEAN_OPERATION') return null
  return ctx.booleanOutlines?.(node) ?? fillOutlines(node)?.outlines ?? null
}
