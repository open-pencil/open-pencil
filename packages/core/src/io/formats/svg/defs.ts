import { fromUint8Array } from 'js-base64'

import type { Effect, Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  colorToHex,
  colorToDisplayCSS,
  getDefaultRenderColorSpace,
  type RenderColorSpace
} from '@open-pencil/scene-graph/color'
import {
  gradientPoint,
  invertGradientTransform,
  isIdentityGradientTransform
} from '@open-pencil/scene-graph/gradient'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { svg, type SVGNode } from './node'
import { round } from './paths'

export interface SVGExportContext {
  defs: SVGNode[]
  defIdCounter: number
  graph: SceneGraph
  colorSpace: RenderColorSpace
  /** Starts every def id, so SVGs inlined on one page cannot reference each other's defs. */
  idPrefix?: string
  /** Paints drawn in `currentColor`, such as an icon's tinted paths, so CSS `color` sets them. */
  tint?: (node: SceneNode) => readonly ('fill' | 'stroke')[]
}

export function nextDefId(ctx: SVGExportContext, prefix: string): string {
  return `${ctx.idPrefix ?? ''}${prefix}${ctx.defIdCounter++}`
}

export function formatColor(
  color: Color,
  opacity = 1,
  colorSpace: RenderColorSpace = getDefaultRenderColorSpace()
): string {
  const alphaColor = { ...color, a: color.a * opacity }
  if (colorSpace === 'display-p3') {
    return colorToDisplayCSS(alphaColor, { colorSpace })
  }
  return colorToHex(alphaColor)
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
      'stop-color': formatColor(s.color, 1, ctx.colorSpace),
      'stop-opacity': s.color.a < 1 ? round(s.color.a) : undefined
    })
  )

  const id = nextDefId(ctx, 'grad')

  // Gradient space in bounding-box units, mapped onto the layer as the canvas draws it.
  const toLayer = invertGradientTransform(t)
  const transform = isIdentityGradientTransform(toLayer)
    ? undefined
    : `matrix(${[toLayer.m00, toLayer.m10, toLayer.m01, toLayer.m11, toLayer.m02, toLayer.m12].map((v) => round(v, 6)).join(' ')})`

  if (fill.type === 'GRADIENT_LINEAR') {
    return {
      id,
      node: svg(
        'linearGradient',
        {
          id,
          x1: 0,
          y1: 0.5,
          x2: 1,
          y2: 0.5,
          gradientUnits: 'objectBoundingBox',
          gradientTransform: transform
        },
        ...stopNodes
      )
    }
  }

  // SVG has no diamond gradient, so a diamond exports as the radial one it is closest to.
  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    return {
      id,
      node: svg(
        'radialGradient',
        {
          id,
          cx: 0.5,
          cy: 0.5,
          r: 0.5,
          gradientUnits: 'objectBoundingBox',
          gradientTransform: transform
        },
        ...stopNodes
      )
    }
  }

  // Nor an angular one: it exports as a radial gradient around its centre.
  if (fill.type === 'GRADIENT_ANGULAR') {
    const center = gradientPoint(t, { x: 0.5, y: 0.5 })
    const cx = round(center.x * node.width)
    const cy = round(center.y * node.height)
    const r = Math.max(node.width, node.height)
    return {
      id,
      node: svg('radialGradient', { id, cx, cy, r, gradientUnits: 'userSpaceOnUse' }, ...stopNodes)
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
  const base64 = fromUint8Array(data)
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

export function createFilterDef(
  effects: Effect[],
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
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
          'flood-color': formatColor(effect.color, 1, ctx.colorSpace),
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
          'flood-color': formatColor(effect.color, 1, ctx.colorSpace),
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

export function resolveFill(fill: Fill, node: SceneNode, ctx: SVGExportContext): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatColor(fill.color, fill.opacity, ctx.colorSpace)
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
