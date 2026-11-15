import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
  parseCSSJustifyContent,
  parseCSSNumber,
  splitCSSValue
} from '@open-pencil/scene-graph/css'
import { layoutSizingUpdates } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'
import type { FlowBlock } from './flow'

type Side = 'MIN' | 'CENTER' | 'MAX'

function side(align: string | undefined): Side | null {
  return align === 'MIN' || align === 'CENTER' || align === 'MAX' ? align : null
}

/** An item's own alignment, or its container's for `auto`; none for `normal` and `stretch`. */
function itemSide(
  item: DesignStyleDeclaration,
  container: DesignStyleDeclaration,
  property: 'align' | 'justify'
): Side | null {
  const own = parseCSSAlignSelf(pickStyle(item, `${property}-self`))
  if (own !== undefined && own !== 'AUTO') return side(own)
  return side(parseCSSAlignItems(pickStyle(container, `${property}-items`)))
}

/**
 * Where content alignment puts a grid's tracks; none for `normal` and `stretch`, which stretch
 * an auto-sized track to fill the grid.
 */
function contentSide(style: DesignStyleDeclaration, property: string): Side | null {
  const value = pickStyle(style, property)?.trim().toLowerCase()
  if (!value || value === 'normal' || value === 'stretch') return null
  return side(parseCSSJustifyContent(value))
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
    contentSide(style, 'align-content') ?? (lone ? itemSide(lone.style, style, 'align') : null)
  if (down) grid.primaryAxisAlign = down
  for (const { layer, style: itemStyle } of inFlow) {
    const across =
      itemSide(itemStyle, style, 'justify') ??
      (layer === lone?.layer ? contentSide(style, 'justify-content') : null)
    if (!across) continue
    if (layer.layoutAlignSelf === 'STRETCH') {
      Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', 'HUG'))
    }
    layer.layoutAlignSelf = across
  }
}
