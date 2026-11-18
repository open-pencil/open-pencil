import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { shadowSpreadOf } from '@open-pencil/scene-graph/geometry'
import { clipsChildren, isLayerContainer } from '@open-pencil/scene-graph/node-defaults'
import { paintShows } from '@open-pencil/scene-graph/paints'
import { regionFills } from '@open-pencil/scene-graph/vector-network'

/** Frames, groups, and the like, whose shadows Figma casts from their children as well. */
export function fillsCastShadow(node: SceneNode): boolean {
  return node.fills.some(paintShows) || regionFills(node.vectorNetwork).some(paintShows)
}

/**
 * The spread a shadow draws with. Figma draws it only where the shadow follows the layer's own
 * outline: a shape whose type spreads, or a filled frame that clips. An unclipped or empty frame
 * casts its children's silhouette unspread, though its render bounds count the spread.
 */
export function shadowSpread(node: SceneNode, effect: Pick<Effect, 'spread'>): number {
  if (!isLayerContainer(node)) return shadowSpreadOf(node, effect)
  return clipsChildren(node) && fillsCastShadow(node) ? effect.spread : 0
}
