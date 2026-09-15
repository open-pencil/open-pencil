import type { SceneNode, Vector } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { ROTATION_HANDLE_DISTANCE } from '#core/constants'
import { fitTextPathBoxToGlyphs, getTextPathData, sampleTextPath } from '#core/text/path'

import type { SceneGeometry } from './scene'

export interface RotationHandleLayout {
  edge: Vector
  handle: Vector
}

/** Drawing and hit-testing must use the same glyph-fitted box and fallback decision. */
export function selectionPath(node: SceneNode) {
  if (node.textPathData === null || !node.textPathBox) return null
  const data = getTextPathData(node)
  const box =
    (data && fitTextPathBoxToGlyphs(data, node.textPathBox, node.derivedTextGlyphs)) ??
    node.textPathBox
  const sampled = data ? sampleTextPath(data, box) : null
  return data && sampled ? { data, box, sampled } : null
}

export function selectionHandleRect(node: SceneNode): Rect {
  return selectionPath(node)?.box ?? { x: 0, y: 0, width: node.width, height: node.height }
}

/** Keep the stalk on the unreflected top edge, opposite the dimension badge. Coordinates remain node-local. */
export function rotationHandleLayout(
  node: SceneNode,
  geometry: SceneGeometry,
  zoom: number,
  rect: Rect = selectionHandleRect(node)
): RotationHandleLayout {
  const direction = geometry.reflections(node).y
  const x = rect.x + rect.width / 2
  const y = direction < 0 ? rect.y + rect.height : rect.y
  return { edge: { x, y }, handle: { x, y: y - (direction * ROTATION_HANDLE_DISTANCE) / zoom } }
}
