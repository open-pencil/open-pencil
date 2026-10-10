import { pick } from 'es-toolkit'

import {
  layoutSizing,
  layoutSizingUpdates,
  type LayoutSizingAxis,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

const SIZING_FIELDS = [
  'primaryAxisSizing',
  'counterAxisSizing',
  'layoutGrow',
  'layoutAlignSelf'
] as const satisfies readonly (keyof SceneNode)[]

export type LayerSizing = Pick<SceneNode, (typeof SIZING_FIELDS)[number]>

const AXES: readonly ['width' | 'height', LayoutSizingAxis][] = [
  ['width', 'HORIZONTAL'],
  ['height', 'VERTICAL']
]

export function layerSizing(node: SceneNode): LayerSizing {
  return pick(node, SIZING_FIELDS)
}

/**
 * The sizing a handle drag leaves the layer with, as Figma sets it: an axis the drag resized stops
 * hugging or filling and becomes fixed, so layout keeps the dragged size, while an axis it left
 * alone keeps its sizing. Text hugs by its auto-resize, which a drag sets elsewhere.
 */
export function draggedSizing(
  graph: SceneGraph,
  node: SceneNode,
  original: LayerSizing,
  origRect: Rect,
  rect: Rect
): LayerSizing {
  const sizing = { ...original }
  if (node.type === 'TEXT') return sizing
  const base = { ...node, ...original }
  for (const [dimension, axis] of AXES) {
    if (rect[dimension] === origRect[dimension]) continue
    if (layoutSizing(graph, base, axis) === 'FIXED') continue
    Object.assign(sizing, pick(layoutSizingUpdates(graph, base, axis, 'FIXED'), SIZING_FIELDS))
  }
  return sizing
}
