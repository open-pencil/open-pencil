import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { RenderOverlays } from '#core/canvas/renderer/types'

/** Whether a presentation keeps the layer off its slide for now, as its build has not brought it on. */
export function heldBackByMotion(node: SceneNode, overlays: RenderOverlays): boolean {
  return overlays.layerMotion?.get(node.id)?.opacity === 0
}

/** Moves the canvas to where a presentation draws an animating layer, and gives its opacity. */
export function applyLayerMotion(
  canvas: Canvas,
  node: SceneNode,
  overlays: RenderOverlays
): number {
  const motion = overlays.layerMotion?.get(node.id)
  if (!motion) return node.opacity
  canvas.translate(motion.x, motion.y)
  return node.opacity * motion.opacity
}
