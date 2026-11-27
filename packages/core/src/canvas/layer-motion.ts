import type { Canvas } from '@open-pencil/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

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

/** How far a presentation moves an animating layer from where it is. */
export function layerMotionOffset(node: SceneNode, overlays: RenderOverlays): Vector {
  const motion = overlays.layerMotion?.get(node.id)
  return motion ? { x: motion.x, y: motion.y } : { x: 0, y: 0 }
}
