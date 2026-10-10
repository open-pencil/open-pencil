import type { Color, Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/**
 * Figma's Selection colors: every solid fill and stroke colour of the selected layers and their
 * descendants, most used first. Effect colours and colours bound to a variable are left out.
 */

export interface SelectionColor {
  /** The colour without alpha; its alpha is in `opacity`. */
  color: Color
  /** The paint's opacity, multiplied by the colour's own alpha. */
  opacity: number
  /** How many paints use it. */
  count: number
}

type PaintKind = 'fills' | 'strokes'
const PAINT_KINDS: readonly PaintKind[] = ['fills', 'strokes']

function paintOpacity(paint: Fill) {
  return paint.opacity * paint.color.a
}

// Integer channels instead of a formatted hex: this runs for every paint in a selection that can
// hold thousands of layers, on each change while the panel is open.
function colorKey(color: Color, opacity: number) {
  const channel = (value: number) => Math.round(value * 255)
  return (
    ((channel(color.r) << 16) | (channel(color.g) << 8) | channel(color.b)) * 101 +
    Math.round(opacity * 100)
  )
}

function listed(node: SceneNode, kind: PaintKind, index: number, paint: Fill) {
  return paint.type === 'SOLID' && paint.visible && !node.boundVariables[`${kind}/${index}/color`]
}

function eachNode(graph: SceneGraph, ids: readonly string[], visit: (node: SceneNode) => void) {
  const seen = new Set<string>()
  const walk = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    const node = graph.getNode(id)
    if (!node) return
    visit(node)
    for (const childId of node.childIds) walk(childId)
  }
  for (const id of ids) walk(id)
}

export function selectionColors(graph: SceneGraph, ids: readonly string[]): SelectionColor[] {
  const colors = new Map<number, SelectionColor>()
  eachNode(graph, ids, (node) => {
    for (const kind of PAINT_KINDS) {
      node[kind].forEach((paint, index) => {
        if (!listed(node, kind, index, paint)) return
        const opacity = paintOpacity(paint)
        const key = colorKey(paint.color, opacity)
        const existing = colors.get(key)
        if (existing) existing.count++
        else colors.set(key, { color: { ...paint.color, a: 1 }, opacity, count: 1 })
      })
    }
  })
  // Most used first; ties in hex order, as Figma lists them.
  return [...colors.entries()]
    .sort(([keyA, a], [keyB, b]) => b.count - a.count || keyA - keyB)
    .map(([, color]) => color)
}

/**
 * The paint changes that turn one selection colour into another on every layer that uses it.
 * Each change replaces that layer's whole `fills` or `strokes` list.
 */
export function replaceSelectionColor(
  graph: SceneGraph,
  ids: readonly string[],
  from: Pick<SelectionColor, 'color' | 'opacity'>,
  to: Pick<SelectionColor, 'color' | 'opacity'>
): Array<{ id: string; changes: Partial<SceneNode> }> {
  const key = colorKey(from.color, from.opacity)
  const updates: Array<{ id: string; changes: Partial<SceneNode> }> = []
  eachNode(graph, ids, (node) => {
    const recolor = <T extends Fill>(kind: PaintKind, paints: readonly T[]): T[] | undefined => {
      const next = paints.map((paint, index) =>
        listed(node, kind, index, paint) && colorKey(paint.color, paintOpacity(paint)) === key
          ? { ...paint, color: { ...to.color, a: 1 }, opacity: to.opacity }
          : paint
      )
      return next.some((paint, index) => paint !== paints[index]) ? next : undefined
    }
    const changes: Partial<Pick<SceneNode, PaintKind>> = {}
    const fills = recolor('fills', node.fills)
    const strokes = recolor('strokes', node.strokes)
    if (fills) changes.fills = fills
    if (strokes) changes.strokes = strokes
    if (changes.fills || changes.strokes) updates.push({ id: node.id, changes })
  })
  return updates
}

/** Whether the Fill and Stroke sections already show every colour, so Figma hides the list. */
export function selectionColorsShown(graph: SceneGraph, ids: readonly string[]): boolean {
  const nodes = ids.map((id) => graph.getNode(id)).filter((node) => node !== undefined)
  if (nodes.some((node) => node.childIds.length > 0)) return true
  if (nodes.length < 2) return false
  const signature = (paints: readonly Fill[]) =>
    paints
      .map((paint) =>
        paint.type === 'SOLID' ? colorKey(paint.color, paintOpacity(paint)) : paint.type
      )
      .join('|')
  const fills = new Set(nodes.map((node) => signature(node.fills)))
  // Layers without strokes don't make strokes differ, as in the Stroke section.
  const strokes = new Set(
    nodes.filter((node) => node.strokes.length > 0).map((node) => signature(node.strokes))
  )
  return fills.size > 1 || strokes.size > 1
}
