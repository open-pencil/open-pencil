import { colorToHex8, colorToCSSCompact } from '#core/color'

import type {
  SceneGraph,
  SceneNode,
  Fill,
  Stroke,
  Effect,
  Color,
  GridTrack
} from '#core/scene-graph'

export function formatColor(color: Color, opacity = 1): string {
  return colorToHex8(color, opacity)
}

export function solidFillColor(fills: Fill[]): string | null {
  const visible = fills.filter((f) => f.visible && f.type === 'SOLID')
  if (visible.length !== 1) return null
  return formatColor(visible[0].color, visible[0].opacity)
}

export function solidStroke(
  strokes: Stroke[]
): { color: string; weight: number; dash: number[] | null } | null {
  const visible = strokes.filter((s) => s.visible)
  if (visible.length !== 1) return null
  const s = visible[0]
  return {
    color: formatColor(s.color, s.opacity),
    weight: s.weight,
    dash: s.dashPattern && s.dashPattern.length > 0 ? [...s.dashPattern] : null
  }
}

export function formatShadow(e: Effect): string | null {
  if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') return null
  return `${e.offset.x} ${e.offset.y} ${e.radius} ${formatColor(e.color, e.color.a)}`
}

export function formatTailwindShadow(e: Effect): string | null {
  if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') return null
  const color = colorToCSSCompact(e.color)
  const inset = e.type === 'INNER_SHADOW' ? 'inset_' : ''
  const spread = e.spread !== 0 ? `_${e.spread}px` : ''
  return `${inset}${e.offset.x}px_${e.offset.y}px_${e.radius}px${spread}_${color}`
}

export function formatTailwindAngle(degrees: number): string {
  const rounded = Number(degrees.toFixed(2))
  const integer = Math.round(rounded)
  const named = new Set([0, 1, 2, 3, 6, 12, 45, 90, 180])
  if (rounded === integer && named.has(integer)) return String(integer)
  return `[${rounded}deg]`
}

export function formatTailwindFontFamily(fontFamily: string): string {
  const escaped = fontFamily.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `['${escaped}']`
}

const JSX_ENTITY: Record<string, string> = {
  '{': '&#123;',
  '}': '&#125;',
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;'
}

export function escapeJSXText(text: string): string {
  return text.replace(/[{}<>&]/g, (c) => JSX_ENTITY[c])
}

export function formatProp(key: string, value: unknown): string {
  if (typeof value === 'string') return `${key}="${value}"`
  if (typeof value === 'number') return `${key}={${value}}`
  if (typeof value === 'boolean') return value ? key : `${key}={false}`
  return `${key}={${JSON.stringify(value)}}`
}

export function getNodeContext(node: SceneNode, graph: SceneGraph) {
  const parent = node.parentId ? graph.getNode(node.parentId) : null
  return {
    isAutoLayout: node.layoutMode !== 'NONE',
    isGrid: node.layoutMode === 'GRID',
    isFlex: node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL',
    parentIsAutoLayout: parent ? parent.layoutMode !== 'NONE' : false,
    parentIsGrid: parent ? parent.layoutMode === 'GRID' : false
  }
}

export type PaddingEdges = { pt: number; pr: number; pb: number; pl: number }

export function collectPadding(node: SceneNode): PaddingEdges | null {
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node
  if (pt === 0 && pr === 0 && pb === 0 && pl === 0) return null
  return { pt, pr, pb, pl }
}

export function emitPadding<T>(
  edges: PaddingEdges,
  uniform: (v: number) => T,
  symmetric: (y: number, x: number) => T[],
  individual: (edges: PaddingEdges) => T[]
): T[] {
  const { pt, pr, pb, pl } = edges
  if (pt === pr && pr === pb && pb === pl) return [uniform(pt)]
  if (pt === pb && pl === pr) return symmetric(pt, pl)
  return individual(edges)
}

export interface CornerRadii {
  tl: number
  tr: number
  br: number
  bl: number
}

export function collectCornerRadii(node: SceneNode): CornerRadii | null {
  if (node.cornerRadius <= 0) return null
  if (node.independentCorners) {
    return {
      tl: node.topLeftRadius,
      tr: node.topRightRadius,
      br: node.bottomRightRadius,
      bl: node.bottomLeftRadius
    }
  }
  const r = node.cornerRadius
  return { tl: r, tr: r, br: r, bl: r }
}

export function formatTrack(t: GridTrack): string {
  if (t.sizing === 'FR') return `${t.value}fr`
  if (t.sizing === 'FIXED') return `${t.value}px`
  return 'auto'
}

export function formatTracks(tracks: GridTrack[]): string {
  return tracks.map(formatTrack).join(' ')
}
