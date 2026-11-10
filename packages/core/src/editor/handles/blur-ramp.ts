import type { Effect, ProgressiveBlur, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { createSceneGeometry, type RotationPreview, type ViewportTransform } from '#core/geometry'

import type { BlurRampEdit } from '#core/editor/types'

/** Figma 126's progressive blur handles: white dots 8 px across, on a 1 px line between them. */
export const BLUR_RAMP_HANDLE = {
  dotRadius: 4,
  /** How far past a dot's edge a press still takes it. */
  hitSlop: 3
} as const

export type BlurRampHandle = 'start' | 'end'

/** Where the edited blur's start and end sit on screen. */
export interface BlurRampLayout {
  start: Vector
  end: Vector
}

/** The blur being edited and its layer, while it is still a progressive blur. */
export function editedBlurRamp(
  graph: SceneGraph,
  edit: BlurRampEdit | null | undefined
): { node: SceneNode; effect: Effect; progressive: ProgressiveBlur } | null {
  if (!edit) return null
  const node = graph.getNode(edit.nodeId)
  const effect = node?.effects.at(edit.index)
  if (!node || !effect?.progressive) return null
  return { node, effect, progressive: effect.progressive }
}

/** Where the edited blur's start and end handles sit on screen. */
export function editedBlurRampLayout(
  graph: SceneGraph,
  edit: BlurRampEdit | null | undefined,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): BlurRampLayout | null {
  const edited = editedBlurRamp(graph, edit)
  if (!edited) return null
  const { node, progressive } = edited
  const geometry = createSceneGeometry(graph, preview)
  const screen = (offset: Vector) =>
    geometry.toScreen(node, { x: offset.x * node.width, y: offset.y * node.height }, viewport)
  return { start: screen(progressive.startOffset), end: screen(progressive.endOffset) }
}

/** The handle under a screen point, the end first where they overlap, as it draws on top. */
export function blurRampHandleAt(layout: BlurRampLayout, screen: Vector): BlurRampHandle | null {
  const reach = BLUR_RAMP_HANDLE.dotRadius + BLUR_RAMP_HANDLE.hitSlop
  for (const handle of ['end', 'start'] as const) {
    const point = layout[handle]
    if (Math.hypot(screen.x - point.x, screen.y - point.y) <= reach) return handle
  }
  return null
}
