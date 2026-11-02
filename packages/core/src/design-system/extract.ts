import type { SceneGraph, SceneNode } from '@lawha/scene-graph'
import { colorToHex } from '@lawha/scene-graph/color'
import type { Color } from '@lawha/scene-graph/primitives'

/** Where a raw value sits on a layer, as `bind_variable` names the field. */
export interface Use {
  node: string
  field: string
}

export interface ColorUse extends Use {
  /** Text colour, as opposed to a shape's fill or stroke. */
  text: boolean
  /** Area the paint covers, so a background outweighs a 1px divider. */
  area: number
}

export interface Found<T> {
  value: T
  uses: Use[]
}

export interface TypeSample {
  family: string
  size: number
  weight: number
  /** Line height in px, or null for Auto or a percentage. */
  lineHeight: number | null
}

export interface Extracted {
  colors: Map<string, { color: Color; uses: ColorUse[] }>
  type: Map<string, { sample: TypeSample; uses: Use[] }>
  spacing: Map<number, Use[]>
  radius: Map<number, Use[]>
  /** Top-level frames, whose most common fill is the page background. */
  roots: string[]
}

const SPACING_FIELDS = [
  'itemSpacing',
  'counterAxisSpacing',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom'
] as const

/** Hex with alpha, so 50%-transparent black is its own token. */
export function colorKey(color: Color): string {
  const alpha = Math.round(color.a * 255)
  return alpha === 255
    ? colorToHex(color)
    : `${colorToHex(color)}${alpha.toString(16).padStart(2, '0').toUpperCase()}`
}

export function typeKey(s: TypeSample): string {
  return `${s.family}|${s.size}|${s.weight}|${s.lineHeight ?? 'auto'}`
}

function add<K>(map: Map<K, Use[]>, key: K, use: Use) {
  const list = map.get(key)
  if (list) list.push(use)
  else map.set(key, [use])
}

function collectColors(out: Extracted, node: SceneNode) {
  const area = node.width * node.height
  const paints = [
    ...node.fills.map((p, i) => ({ p, field: `fills/${i}/color` })),
    ...node.strokes.map((p, i) => ({ p, field: `strokes/${i}/color` }))
  ]
  for (const { p, field } of paints) {
    if (p.type !== 'SOLID' || !p.visible || node.boundVariables[field]) continue
    const color = { ...p.color, a: p.color.a * p.opacity }
    const key = colorKey(color)
    const entry = out.colors.get(key) ?? { color, uses: [] }
    entry.uses.push({
      node: node.id,
      field,
      text: node.type === 'TEXT',
      area: field.startsWith('fills') ? area : 0
    })
    out.colors.set(key, entry)
  }
}

function collectType(out: Extracted, node: SceneNode) {
  if (node.type !== 'TEXT' || !node.fontFamily) return
  const sample: TypeSample = {
    family: node.fontFamily,
    size: node.fontSize,
    weight: node.fontWeight,
    lineHeight: node.lineHeight?.unit === 'PIXELS' ? node.lineHeight.value : null
  }
  const key = typeKey(sample)
  const entry = out.type.get(key) ?? { sample, uses: [] }
  entry.uses.push({ node: node.id, field: 'fontSize' })
  out.type.set(key, entry)
}

function collectSpacing(out: Extracted, node: SceneNode) {
  const bound = node.boundVariables
  if (node.layoutMode !== 'NONE')
    for (const field of SPACING_FIELDS) {
      const value = node[field]
      if (value > 0 && !bound[field]) add(out.spacing, value, { node: node.id, field })
    }
  if (node.cornerRadius > 0 && !bound.cornerRadius)
    add(out.radius, node.cornerRadius, { node: node.id, field: 'cornerRadius' })
}

/** Collects the raw colours, type, spacing and radii the layers under `rootIds` use. */
export function extract(graph: SceneGraph, rootIds: readonly string[]): Extracted {
  const out: Extracted = {
    colors: new Map(),
    type: new Map(),
    spacing: new Map(),
    radius: new Map(),
    roots: [...rootIds]
  }
  const visit = (node: SceneNode) => {
    if (!node.visible) return
    collectColors(out, node)
    collectType(out, node)
    collectSpacing(out, node)
    for (const id of node.childIds) {
      const child = graph.getNode(id)
      if (child) visit(child)
    }
  }
  for (const id of rootIds) {
    const node = graph.getNode(id)
    if (node) visit(node)
  }
  return out
}
