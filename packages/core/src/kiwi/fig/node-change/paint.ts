import type { Paint, Effect as KiwiEffect } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type {
  Fill,
  FillType,
  Stroke,
  Effect,
  BlendMode,
  ImageScaleMode,
  GradientTransform,
  StrokeCap,
  StrokeJoin
} from '@open-pencil/scene-graph'
import type { Color, Matrix } from '@open-pencil/scene-graph/primitives'

import { normalizeColor } from '#core/color'

const convertColor = normalizeColor

function imageHashToString(hash: Record<string, number>): string {
  const bytes = Object.keys(hash)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => hash[Number(k)])
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function convertGradientTransform(t?: Matrix): GradientTransform | undefined {
  if (!t) return undefined
  return { m00: t.m00, m01: t.m01, m02: t.m02, m10: t.m10, m11: t.m11, m12: t.m12 }
}

type VariableAliasRef = NonNullable<NonNullable<NonNullable<Paint['colorVar']>['value']>['alias']>

let variableColorResolver: ((alias: VariableAliasRef) => Color | null) | null = null

export function setVariableColorResolver(
  resolver: ((alias: VariableAliasRef) => Color | null) | null
): void {
  variableColorResolver = resolver
}

function resolveColorVar(paint: Paint): Color | undefined {
  const alias = paint.colorVar?.value?.alias
  if (!alias || !variableColorResolver) return undefined
  return variableColorResolver(alias) ?? undefined
}

function convertBaseFill(p: Paint): Fill {
  return {
    type: p.type as FillType,
    color: convertColor(resolveColorVar(p) ?? p.color),
    opacity: p.opacity ?? 1,
    visible: p.visible ?? true,
    blendMode: (p.blendMode ?? 'NORMAL') as BlendMode
  }
}

function applyGradientPaintFields(fill: Fill, p: Paint): void {
  if (!p.type.startsWith('GRADIENT') || !p.stops) return
  fill.gradientStops = p.stops.map((s) => ({
    color: convertColor(s.color),
    position: s.position
  }))
  if (p.transform) fill.gradientTransform = convertGradientTransform(p.transform)
}

function applyImagePaintFields(fill: Fill, p: Paint): void {
  if (p.type !== 'IMAGE') return
  if (p.image && typeof p.image === 'object') {
    const img = p.image as { hash: string | Record<string, number> }
    if (typeof img.hash === 'object') {
      fill.imageHash = imageHashToString(img.hash)
    } else if (typeof img.hash === 'string') {
      fill.imageHash = img.hash
    }
  }
  fill.imageScaleMode = (p.imageScaleMode ?? 'FILL') as ImageScaleMode
  if (p.transform) fill.imageTransform = convertGradientTransform(p.transform)
}

function applySchemaPaintFields(fill: Fill, p: Paint): void {
  if (p.sourceNodeId) fill.sourceNodeId = guidToString(p.sourceNodeId)
  if (p.scale) fill.scale = p.scale
  if (p.spacing) fill.spacing = p.spacing
  if (p.patternSpacing) fill.patternSpacing = p.patternSpacing
  if (p.patternTileType) fill.patternTileType = p.patternTileType as Fill['patternTileType']
  if (p.verticalAlignment) fill.verticalAlignment = p.verticalAlignment as Fill['verticalAlignment']
  if (p.horizontalAlignment)
    fill.horizontalAlignment = p.horizontalAlignment as Fill['horizontalAlignment']
  if (p.noiseType) fill.noiseType = p.noiseType as Fill['noiseType']
  if (p.density !== undefined) fill.density = p.density
  if (p.noiseSize) fill.noiseSize = p.noiseSize
  if (p.customEffectId?.guid) fill.customEffectId = guidToString(p.customEffectId.guid)
}

export function convertFills(paints?: Paint[]): Fill[] {
  if (!paints) return []
  return paints.map((p) => {
    const fill = convertBaseFill(p)
    applyGradientPaintFields(fill, p)
    applyImagePaintFields(fill, p)
    applySchemaPaintFields(fill, p)
    return fill
  })
}

export function convertStrokes(
  paints?: Paint[],
  weight?: number,
  align?: string,
  cap?: StrokeCap,
  join?: StrokeJoin,
  dashPattern?: number[]
): Stroke[] {
  if (!paints) return []
  let strokeAlign: 'INSIDE' | 'OUTSIDE' | 'CENTER' = 'CENTER'
  if (align === 'INSIDE') strokeAlign = 'INSIDE'
  else if (align === 'OUTSIDE') strokeAlign = 'OUTSIDE'

  return paints.map((p) => ({
    color: convertColor(resolveColorVar(p) ?? p.color),
    weight: weight ?? 1,
    opacity: p.opacity ?? 1,
    visible: p.visible ?? true,
    align: strokeAlign,
    cap: cap ?? 'NONE',
    join: join ?? 'MITER',
    dashPattern: dashPattern ?? []
  }))
}

export function convertEffects(effects?: KiwiEffect[]): Effect[] {
  if (!effects) return []
  return effects.map((e) => ({
    type: e.type,
    color: convertColor(e.color),
    offset: e.offset ?? { x: 0, y: 0 },
    radius: e.radius ?? 0,
    spread: e.spread ?? 0,
    visible: e.visible ?? true,
    blendMode: (e.blendMode ?? 'NORMAL') as BlendMode,
    showShadowBehindNode: e.showShadowBehindNode ?? true
  }))
}
