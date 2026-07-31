import svgpath from 'svgpath'

import type { Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import { parseSVGDocument } from '#core/io/formats/svg/document'

export interface SVGViewportMapping {
  space: Rect
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
}

function alignmentOffset(align: string, remaining: number, axis: 'x' | 'y'): number {
  const token = axis === 'x' ? align.slice(0, 4) : align.slice(4)
  if (token.endsWith('Mid')) return remaining / 2
  if (token.endsWith('Max')) return remaining
  return 0
}

export function resolveSVGViewportMapping(
  svg: string,
  space: Rect,
  bounds: Size,
  preserveAspectRatio: boolean
): SVGViewportMapping {
  const scaleX = bounds.width / space.width
  const scaleY = bounds.height / space.height
  if (!preserveAspectRatio) return { space, scaleX, scaleY, offsetX: 0, offsetY: 0 }

  const value =
    parseSVGDocument(svg)?.documentElement?.getAttribute('preserveAspectRatio')?.trim() ?? ''
  const tokens = value.split(/\s+/).filter(Boolean)
  if (tokens.includes('none')) return { space, scaleX, scaleY, offsetX: 0, offsetY: 0 }
  const align = tokens.find((token) => token.startsWith('x')) ?? 'xMidYMid'

  const uniformScale = tokens.includes('slice')
    ? Math.max(scaleX, scaleY)
    : Math.min(scaleX, scaleY)
  const remainingX = bounds.width - space.width * uniformScale
  const remainingY = bounds.height - space.height * uniformScale
  return {
    space,
    scaleX: uniformScale,
    scaleY: uniformScale,
    offsetX: alignmentOffset(align, remainingX, 'x'),
    offsetY: alignmentOffset(align, remainingY, 'y')
  }
}

export function mapSVGPathToViewport(d: string, mapping: SVGViewportMapping): string {
  return svgpath(d)
    .translate(-mapping.space.x, -mapping.space.y)
    .scale(mapping.scaleX, mapping.scaleY)
    .translate(mapping.offsetX, mapping.offsetY)
    .toString()
}

export function mapSVGPointToViewport(
  x: number,
  y: number,
  elementTransform: string | null,
  gradientTransform: string | null,
  mapping: SVGViewportMapping
): Vector {
  let path = svgpath(`M${x} ${y}`)
  if (gradientTransform) path = path.transform(gradientTransform)
  if (elementTransform) path = path.transform(elementTransform)
  path = path
    .translate(-mapping.space.x, -mapping.space.y)
    .scale(mapping.scaleX, mapping.scaleY)
    .translate(mapping.offsetX, mapping.offsetY)
  const points: Vector[] = []
  path.abs().iterate((segment) => {
    if (points.length === 0 && segment[0] === 'M') {
      points.push({ x: segment[1], y: segment[2] })
    }
  })
  return points[0] ?? { x, y }
}

/** Apply the complete SVG transform grammar through svgpath. */
export function applySVGTransformToPath(d: string, transform: string | null): string {
  if (!transform || transform === 'none') return d
  try {
    return svgpath(d).transform(transform).toString()
  } catch (error) {
    console.warn('Ignoring unsupported SVG transform:', transform, error)
    return d
  }
}
