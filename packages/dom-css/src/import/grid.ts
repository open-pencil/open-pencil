import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber, splitCSSValue } from '@open-pencil/scene-graph/css'
import { layoutSizingUpdates } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'
import type { FlowBlock } from './flow'

type Side = 'MIN' | 'CENTER' | 'MAX'

const SIDES: Partial<Record<string, Side>> = {
  start: 'MIN',
  'flex-start': 'MIN',
  'self-start': 'MIN',
  left: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  'flex-end': 'MAX',
  'self-end': 'MAX',
  right: 'MAX'
}

/**
 * The side a box alignment value (CSS Box Alignment §4–5) puts an item or the tracks on, past a
 * `safe`, `unsafe`, or `legacy` keyword; none for `normal`, `stretch`, `auto`, and baselines.
 */
function sideOf(value: string | undefined): Side | null {
  const words = splitCSSValue(value?.trim().toLowerCase() ?? '')
  return SIDES[words.at(-1) ?? ''] ?? null
}

/** An item's own alignment, or its container's for `auto`. */
function itemSide(
  item: DesignStyleDeclaration,
  container: DesignStyleDeclaration,
  property: 'align' | 'justify'
): Side | null {
  const own = pickStyle(item, `${property}-self`)?.trim()
  if (own && own !== 'auto') return sideOf(own)
  return sideOf(pickStyle(container, `${property}-items`))
}

/** Whether a grid lays its items out in one column, as the stack block flow builds does. */
function singleColumn(style: DesignStyleDeclaration): boolean {
  const columns = splitCSSValue(pickStyle(style, 'grid-template-columns')?.trim() ?? 'none')
  return columns.length === 1 && !columns[0].toLowerCase().startsWith('repeat(')
}

/**
 * Aligns a one-column grid's items as the grid does, laid out as the vertical stack block flow
 * builds: `align-content` packs its rows at the top, middle, or bottom, and a lone item, whose
 * row fills the grid, takes its own `align-self` or the grid's `align-items` there too, and
 * `justify-content` across, as its column hugs it. `justify-self`, or the grid's
 * `justify-items`, puts each item across, hugging its content rather than stretching. Rows are
 * `row-gap` apart. A grid of several columns stays a stack, and placement puts its items.
 */
export function alignGridItems(
  graph: SceneGraph,
  grid: SceneNode,
  items: readonly FlowBlock[],
  style: DesignStyleDeclaration
): void {
  if (grid.layoutMode !== 'VERTICAL' || !singleColumn(style)) return
  grid.itemSpacing = parseCSSNumber(pickStyle(style, 'row-gap')) ?? 0
  const inFlow = items.filter(({ layer }) => layer.layoutPositioning !== 'ABSOLUTE')
  const [lone] = inFlow.length === 1 ? inFlow : []
  const down =
    sideOf(pickStyle(style, 'align-content')) ??
    (lone ? itemSide(lone.style, style, 'align') : null)
  if (down) grid.primaryAxisAlign = down
  for (const { layer, style: itemStyle } of inFlow) {
    const across =
      itemSide(itemStyle, style, 'justify') ??
      (layer === lone?.layer ? sideOf(pickStyle(style, 'justify-content')) : null)
    if (!across) continue
    if (layer.layoutAlignSelf === 'STRETCH') {
      Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', 'HUG'))
    }
    layer.layoutAlignSelf = across
  }
}
