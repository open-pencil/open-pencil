import type { SceneNode, StrokeCap, VectorNetwork } from '@open-pencil/scene-graph'
import {
  arrowLinesSegments,
  circleCapRadius,
  collectArrowEndpoints,
  diamondCapPoints,
  equilateralArrowPoints,
  hasTrimmedShaft,
  trimArrowShafts,
  triangleCapPoints,
  type ArrowEndpoint
} from '@open-pencil/scene-graph/arrow-caps'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { addOpenSegmentsToPath } from '#core/vector/path-helpers'

import { svg, type SVGNode } from './node'
import { round, svgPathSink } from './paths'

type Attrs = Record<string, string | number | undefined>

/** Which of a network's segments to draw: all of them, or those no region encloses. */
type SegmentsOf = (network: VectorNetwork) => VectorNetwork['segments']

const allSegments: SegmentsOf = (network) => network.segments

/**
 * Open segments of a vector network as the canvas strokes them: corners rounded by the layer's
 * corner radius, and, under `stroke`, the line pulled back from each triangle or equilateral head.
 * The whole network is trimmed before `segmentsOf` picks from it, so only its own open ends are.
 */
function openStrokePath(
  node: Pick<SceneNode, 'cornerRadius' | 'strokeCap'>,
  network: VectorNetwork,
  stroke: { weight: number; cap?: StrokeCap; align: string } | undefined,
  segmentsOf: SegmentsOf
): string {
  const cap = stroke?.cap ?? node.strokeCap
  const trimmed =
    stroke?.align === 'CENTER' && hasTrimmedShaft(network, cap)
      ? trimArrowShafts(network, cap, stroke.weight)
      : network
  const parts: string[] = []
  const segments = segmentsOf(trimmed)
  addOpenSegmentsToPath(svgPathSink(parts), segments, trimmed.vertices, node.cornerRadius)
  return parts.join('')
}

/** Stroke attributes cleared, for a fill drawn apart from its stroke. */
const NO_STROKE = {
  stroke: undefined,
  'stroke-width': undefined,
  'stroke-opacity': undefined,
  'stroke-linecap': undefined,
  'stroke-linejoin': undefined,
  'stroke-dasharray': undefined
}

/**
 * A network's open segments, chosen by `segmentsOf`, as the canvas draws them: corners rounded, and
 * the line pulled back under its heads, with any fill kept to the whole path.
 */
export function openPathElements(
  node: Pick<SceneNode, 'cornerRadius' | 'strokeCap' | 'strokes'>,
  network: VectorNetwork,
  common: Attrs,
  segmentsOf: SegmentsOf = allSegments
): SVGNode[] {
  const stroke = node.strokes.find((item) => item.visible)
  const d = openStrokePath(node, network, stroke, segmentsOf)
  const whole = openStrokePath(node, network, undefined, segmentsOf)
  if (d === whole) return [svg('path', { d, ...common })]
  const shaft = svg('path', { d, ...common, fill: 'none' })
  if (common.fill === 'none') return [shaft]
  return [svg('path', { d: whole, ...common, ...NO_STROKE }), shaft]
}

function polygonData(points: readonly Vector[]): string {
  const commands = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${round(x)} ${round(y)}`)
  return `${commands.join('')}Z`
}

/**
 * A head on an open end, in the stroke's colour as `strokeAttrs` gives it: a line arrow stroked at
 * the line's weight with round ends, the others filled.
 */
function headElement(
  { x, y, angle, cap }: ArrowEndpoint,
  weight: number,
  strokeAttrs: Attrs
): SVGNode {
  const color = strokeAttrs.stroke
  const opacity = strokeAttrs['stroke-opacity']
  const filled = (points: readonly Vector[]) =>
    svg('path', { d: polygonData(points), fill: color, 'fill-opacity': opacity })
  switch (cap) {
    case 'ARROW_LINES': {
      // One path, so the wings meet in a round join rather than overlapping at the tip.
      const [first, second] = arrowLinesSegments(x, y, angle, weight)
      const point = ({ x: px, y: py }: Vector) => `${round(px)} ${round(py)}`
      return svg('path', {
        d: `M${point(first.to)}L${point(first.from)}L${point(second.to)}`,
        fill: 'none',
        stroke: color,
        'stroke-opacity': opacity,
        'stroke-width': round(weight),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      })
    }
    case 'CIRCLE_FILLED':
      return svg('circle', {
        cx: round(x),
        cy: round(y),
        r: round(circleCapRadius(weight)),
        fill: color,
        'fill-opacity': opacity
      })
    case 'ARROW_EQUILATERAL':
      return filled(equilateralArrowPoints(x, y, angle, weight))
    case 'TRIANGLE_FILLED':
      return filled(triangleCapPoints(x, y, angle, weight))
  }
  return filled(diamondCapPoints(x, y, angle, weight))
}

/** The arrow heads a stroke puts on `network`'s open ends, or none without a visible stroke. */
export function arrowHeadElements(
  node: Pick<SceneNode, 'strokeCap'>,
  network: VectorNetwork,
  stroke: { weight: number; cap?: StrokeCap } | undefined,
  strokeAttrs: Attrs
): SVGNode[] {
  if (!stroke || !strokeAttrs.stroke || strokeAttrs.stroke === 'none') return []
  return collectArrowEndpoints(network, stroke.cap ?? node.strokeCap).map((endpoint) =>
    headElement(endpoint, stroke.weight, strokeAttrs)
  )
}

/** The heads a vector's first visible stroke puts on its open ends. */
export function vectorArrowHeads(
  node: Pick<SceneNode, 'strokeCap' | 'strokes'>,
  network: VectorNetwork,
  strokeAttrs: Attrs
): SVGNode[] {
  const stroke = node.strokes.find((item) => item.visible)
  return arrowHeadElements(node, network, stroke, strokeAttrs)
}
