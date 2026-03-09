import { colorToHex, colorToHex8 } from './color'
import { round } from './svg-export-paths'

import { svg } from './svg-node'

import type { SVGNode } from './svg-node'
import type { SceneGraph, SceneNode, Fill, Effect } from './scene-graph'
import type { Color } from './types'

export interface SVGExportContext {
  defs: SVGNode[]
  defIdCounter: number
  graph: SceneGraph
}

export function nextDefId(ctx: SVGExportContext, prefix: string): string {
  return `${prefix}${ctx.defIdCounter++}`
}

export function formatColor(color: Color, opacity = 1): string {
  return colorToHex8(color, opacity)
}

function createGradientDef(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return null

  const stopNodes = stops.map((s) =>
    svg('stop', {
      offset: `${round(s.position * 100)}%`,
      'stop-color': colorToHex(s.color),
      'stop-opacity': s.color.a < 1 ? round(s.color.a) : undefined
    })
  )

  const id = nextDefId(ctx, 'grad')

  if (fill.type === 'GRADIENT_LINEAR') {
    const startX = round(t.m02 * 100)
    const startY = round(t.m12 * 100)
    const endX = round((t.m00 + t.m02) * 100)
    const endY = round((t.m10 + t.m12) * 100)
    return {
      id,
      node: svg(
        'linearGradient',
        {
          id,
          x1: `${startX}%`,
          y1: `${startY}%`,
          x2: `${endX}%`,
          y2: `${endY}%`,
          gradientUnits: 'objectBoundingBox'
        },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    const cx = round(t.m02 * 100)
    const cy = round(t.m12 * 100)
    const r = round(Math.sqrt(t.m00 * t.m00 + t.m10 * t.m10) * 100)
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx: `${cx}%`, cy: `${cy}%`, r: `${r}%`, gradientUnits: 'objectBoundingBox' },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_ANGULAR') {
    const cx = round(t.m02 * node.width)
    const cy = round(t.m12 * node.height)
    const r = Math.max(node.width, node.height)
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx, cy, r, gradientUnits: 'userSpaceOnUse' },
        ...stopNodes
      )
    }
  }

  return null
}

function createImagePattern(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  if (!fill.imageHash) return null
  const data = ctx.graph.images.get(fill.imageHash)
  if (!data) return null

  const id = nextDefId(ctx, 'img')
  const base64 = btoa(String.fromCharCode(...data))
  const mime = detectImageMime(data)

  return {
    id,
    node: svg(
      'pattern',
      {
        id,
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1
      },
      svg('image', {
        href: `data:${mime};base64,${base64}`,
        width: node.width,
        height: node.height,
        preserveAspectRatio: fill.imageScaleMode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice'
      })
    )
  }
}

function detectImageMime(data: Uint8Array): string {
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
  if (data[0] === 0x52 && data[1] === 0x49) return 'image/webp'
  return 'image/png'
}

export function createFilterDef(effects: Effect[], ctx: SVGExportContext): { id: string; node: SVGNode } | null {
  const visible = effects.filter((e) => e.visible)
  if (visible.length === 0) return null

  const id = nextDefId(ctx, 'fx')
  const primitives: SVGNode[] = []

  for (const effect of visible) {
    if (effect.type === 'DROP_SHADOW') {
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feDropShadow', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          stdDeviation: stdDev,
          'flood-color': colorToHex(effect.color),
          'flood-opacity': round(effect.color.a)
        })
      )
    } else if (effect.type === 'INNER_SHADOW') {
      const sid = `${id}_is`
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: stdDev, result: `${sid}_blur` }),
        svg('feOffset', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          result: `${sid}_off`
        }),
        svg('feComposite', {
          in: 'SourceAlpha',
          in2: `${sid}_off`,
          operator: 'out',
          result: `${sid}_inv`
        }),
        svg('feFlood', {
          'flood-color': colorToHex(effect.color),
          'flood-opacity': round(effect.color.a)
        }),
        svg('feComposite', { in2: `${sid}_inv`, operator: 'in', result: `${sid}_shadow` }),
        svg('feComposite', {
          in: `${sid}_shadow`,
          in2: 'SourceGraphic',
          operator: 'over'
        })
      )
    } else {
      const stdDev = round(effect.radius / 2)
      primitives.push(svg('feGaussianBlur', { stdDeviation: stdDev }))
    }
  }

  if (primitives.length === 0) return null

  return {
    id,
    node: svg('filter', { id }, ...primitives)
  }
}

export function resolveFill(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatColor(fill.color, fill.opacity)
  }

  if (fill.type.startsWith('GRADIENT')) {
    const grad = createGradientDef(fill, node, ctx)
    if (grad) {
      ctx.defs.push(grad.node)
      return `url(#${grad.id})`
    }
  }

  if (fill.type === 'IMAGE') {
    const pattern = createImagePattern(fill, node, ctx)
    if (pattern) {
      ctx.defs.push(pattern.node)
      return `url(#${pattern.id})`
    }
  }

  return null
}

export const SVG_STROKE_CAP: Record<string, string> = {
  NONE: 'butt',
  ROUND: 'round',
  SQUARE: 'square'
}

export const SVG_STROKE_JOIN: Record<string, string> = {
  MITER: 'miter',
  ROUND: 'round',
  BEVEL: 'bevel'
}

export const SVG_BLEND_MODE: Record<string, string> = {
  NORMAL: 'normal',
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  COLOR_BURN: 'color-burn',
  LIGHTEN: 'lighten',
  SCREEN: 'screen',
  COLOR_DODGE: 'color-dodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'soft-light',
  HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity'
}
