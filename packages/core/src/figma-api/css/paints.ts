import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { gradientPoint, isGradientFill } from '@open-pencil/scene-graph/gradient'

import { boundValue, cssColor, cssNumber } from './values'

// Paints as Figma's Dev Mode writes them in `getCSSAsync` (Figma desktop 126).

function percent(value: number): string {
  return `${cssNumber(value * 100)}%`
}

function stops(fill: Fill): string {
  return (fill.gradientStops ?? [])
    .map((stop) => `${cssColor(stop.color, fill.opacity)} ${percent(stop.position)}`)
    .join(', ')
}

/** A linear gradient's angle: 0deg runs up, 90deg to the right, across the layer's own box. */
function linearAngle(fill: Fill, node: SceneNode): number {
  const t = fill.gradientTransform
  if (!t) return 90
  const start = gradientPoint(t, { x: 0, y: 0.5 })
  const end = gradientPoint(t, { x: 1, y: 0.5 })
  const dx = (end.x - start.x) * node.width
  const dy = (end.y - start.y) * node.height
  return ((((Math.atan2(dx, -dy) * 180) / Math.PI) % 360) + 360) % 360
}

function radialShape(fill: Fill): string {
  const t = fill.gradientTransform
  if (!t) return '50% 50% at 50% 50%'
  const center = gradientPoint(t, { x: 0.5, y: 0.5 })
  const right = gradientPoint(t, { x: 1, y: 0.5 })
  const bottom = gradientPoint(t, { x: 0.5, y: 1 })
  const rx = Math.hypot(right.x - center.x, right.y - center.y)
  const ry = Math.hypot(bottom.x - center.x, bottom.y - center.y)
  return `${percent(rx)} ${percent(ry)} at ${percent(center.x)} ${percent(center.y)}`
}

/**
 * One paint as a background layer. A solid colour below others is written plainly; above them
 * Dev Mode writes it as a gradient of one colour, the only way CSS stacks a colour.
 */
function paintLayer(
  graph: SceneGraph,
  node: SceneNode,
  fill: Fill,
  index: number,
  bottom: boolean
): string | null {
  if (fill.type === 'SOLID') {
    const color = boundValue(
      graph,
      node,
      `fills/${index}/color`,
      cssColor(fill.color, fill.opacity)
    )
    return bottom ? color : `linear-gradient(0deg, ${color} 0%, ${color} 100%)`
  }
  if (fill.type === 'GRADIENT_LINEAR') {
    return `linear-gradient(${cssNumber(linearAngle(fill, node))}deg, ${stops(fill)})`
  }
  if (fill.type === 'GRADIENT_RADIAL')
    return `radial-gradient(${radialShape(fill)}, ${stops(fill)})`
  if (isGradientFill(fill.type)) return null
  if (fill.type === 'IMAGE') {
    const size = fill.imageScaleMode === 'FIT' ? 'contain' : 'cover'
    return `url(<path-to-image>) lightgray 50% / ${size} no-repeat`
  }
  return null
}

/** The layer's visible fills as one `background`, the top paint first, or null without one. */
export function backgroundCSS(graph: SceneGraph, node: SceneNode): string | null {
  const layers = node.fills
    .map((fill, index) => ({ fill, index }))
    .filter(({ fill }) => fill.visible)
    .reverse()
    .flatMap(({ fill, index }, order, all) => {
      const layer = paintLayer(graph, node, fill, index, order === all.length - 1)
      return layer ? [layer] : []
    })
  return layers.length > 0 ? layers.join(', ') : null
}

/** The top visible solid fill's colour, as text's `color` and a shape's `fill` take it. */
export function solidColorCSS(
  graph: SceneGraph,
  node: SceneNode,
  paints: 'fills' | 'strokes'
): string | null {
  const list = node[paints]
  for (let index = list.length - 1; index >= 0; index--) {
    const paint = list[index]
    if (!paint.visible || paint.type !== 'SOLID') continue
    return boundValue(graph, node, `${paints}/${index}/color`, cssColor(paint.color, paint.opacity))
  }
  return null
}
