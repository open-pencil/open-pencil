import type { FunctionalComponent } from 'vue'

import type { ConnectorLineType, StrokeCap } from '@open-pencil/scene-graph'
import {
  arrowLinesSegments,
  circleCapRadius,
  diamondCapPoints,
  equilateralArrowPoints,
  triangleCapPoints
} from '@open-pencil/scene-graph/arrow-caps'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { maskIcon } from './mask'

/** The icon box, and the weight its line is drawn at, as lucide draws its icons. */
const BOX = 24
const WEIGHT = 1.5
/** The weight the heads are sized by: larger than the line's, so they read at icon size. */
const HEAD_WEIGHT = 2
/** Where the line's capped end sits, leaving room for the largest head. */
const TIP = 18
const TAIL = 3

const round = (value: number) => Math.round(value * 100) / 100

function polygon(points: readonly Vector[]): string {
  return `<path d="M${points.map((point) => `${round(point.x)} ${round(point.y)}`).join('L')}Z"/>`
}

/** A cap's head at the line's right end, drawn from the geometry the canvas draws it from. */
function head(cap: StrokeCap): string {
  const y = BOX / 2
  switch (cap) {
    case 'ARROW_LINES': {
      const [first, second] = arrowLinesSegments(TIP, y, 0, HEAD_WEIGHT)
      const d = `M${round(first.to.x)} ${round(first.to.y)}L${TIP} ${y}L${round(second.to.x)} ${round(second.to.y)}`
      return `<path d="${d}" fill="none" stroke="black" stroke-width="${WEIGHT}" stroke-linecap="round" stroke-linejoin="round"/>`
    }
    case 'ARROW_EQUILATERAL':
      return polygon(equilateralArrowPoints(TIP, y, 0, HEAD_WEIGHT))
    case 'TRIANGLE_FILLED':
      return polygon(triangleCapPoints(TIP, y, 0, HEAD_WEIGHT))
    case 'DIAMOND_FILLED':
      return polygon(diamondCapPoints(TIP, y, 0, HEAD_WEIGHT))
    case 'CIRCLE_FILLED':
      return `<circle cx="${TIP}" cy="${y}" r="${round(circleCapRadius(HEAD_WEIGHT))}"/>`
    default:
      return ''
  }
}

/** A short line ending in `cap`, pointing right, or left for a start point. */
function capSVG(cap: StrokeCap, side: 'start' | 'end'): string {
  const y = BOX / 2
  const shaft = `<path d="M${TAIL} ${y}H${TIP}" fill="none" stroke="black" stroke-width="${WEIGHT}" stroke-linecap="round"/>`
  const flip = side === 'start' ? ` transform="matrix(-1 0 0 1 ${BOX} 0)"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}"><g${flip}>${shaft}${head(cap)}</g></svg>`
}

/** Each line type as FigJam's line shape menu draws it. */
const LINE_TYPE_PATHS: Record<ConnectorLineType, string> = {
  ELBOWED: 'M3 6H9A3 3 0 0 1 12 9V15A3 3 0 0 0 15 18H21',
  CURVED: 'M3 6C13 6 11 18 21 18',
  STRAIGHT: 'M3 18L21 6'
}

function lineTypeSVG(type: ConnectorLineType): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}"><path d="${LINE_TYPE_PATHS[type]}" fill="none" stroke="black" stroke-width="${WEIGHT}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

const CAPS: readonly StrokeCap[] = [
  'NONE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'TRIANGLE_FILLED',
  'DIAMOND_FILLED',
  'CIRCLE_FILLED'
]

const CAP_ICONS = {
  start: new Map(CAPS.map((cap) => [cap, maskIcon(capSVG(cap, 'start'))])),
  end: new Map(CAPS.map((cap) => [cap, maskIcon(capSVG(cap, 'end'))]))
}

/** The icon for a connector's cap at its start or end, drawn as the canvas draws the head. */
export function connectorCapIcon(
  cap: StrokeCap,
  side: 'start' | 'end'
): FunctionalComponent | undefined {
  return CAP_ICONS[side].get(cap)
}

/** Each line type's icon. */
export const CONNECTOR_LINE_TYPE_ICONS = Object.fromEntries(
  (Object.keys(LINE_TYPE_PATHS) as ConnectorLineType[]).map((type) => [
    type,
    maskIcon(lineTypeSVG(type))
  ])
) as Record<ConnectorLineType, FunctionalComponent>
