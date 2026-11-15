import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
  parseCSSJustifyContent,
  dimension,
  parseCSSNumber,
  splitCSSValue
} from '@open-pencil/scene-graph/css'
import { layoutSizingUpdates } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { contentInsets } from './box'
import { pickStyle } from './css-values'
import type { FlowBlock } from './flow'

type Side = 'MIN' | 'CENTER' | 'MAX'

/** Whether the display lays its children out as grid items. */
export function isGrid(display: string): boolean {
  return display === 'grid' || display === 'inline-grid'
}

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

/**
 * A grid's one column: `auto` when the grid names none or an `auto` track, `fr` for a flexible
 * one, or its width in pixels, as a browser resolves any of them once laid out. Null for several
 * columns, or a track the importer cannot read.
 */
function singleColumn(style: DesignStyleDeclaration): 'auto' | 'fr' | number | null {
  const columns = splitCSSValue(pickStyle(style, 'grid-template-columns')?.trim() ?? 'none')
  if (columns.length !== 1) return null
  const [track] = columns
  if (track === 'none' || track === 'auto') return 'auto'
  const size = dimension(track)
  if (size?.unit === 'fr') return 'fr'
  return size?.unit === 'px' ? size.number : null
}

/** The width of a box's content box, from a `width` of its own. */
function contentWidth(style: DesignStyleDeclaration): number | null {
  const width = parseCSSNumber(pickStyle(style, 'width'))
  if (width === null || pickStyle(style, 'box-sizing')?.trim() !== 'border-box') return width
  const insets = contentInsets(style)
  return width - insets.left - insets.right
}

/**
 * Aligns a one-column grid's items as the grid does, laid out as the vertical stack block flow
 * builds: `align-content` packs its rows at the top, middle, or bottom, and a lone item, whose
 * row fills the grid, takes its own `align-self` or the grid's `align-items` there too.
 * Across, a column that fills the grid lets `justify-self`, or the grid's `justify-items`, put
 * each item, hugging its content rather than stretching. A narrower column, which
 * `justify-content` places, holds a lone item as wide as it where the column goes; any other
 * item sits within a column apart from the grid's edges, which a stack cannot hold, and
 * placement puts it. Rows are `row-gap` apart. A grid of several columns stays a stack.
 */
export function alignGridItems(
  graph: SceneGraph,
  grid: SceneNode,
  items: readonly FlowBlock[],
  style: DesignStyleDeclaration
): void {
  const column = singleColumn(style)
  if (grid.layoutMode !== 'VERTICAL' || column === null) return
  grid.itemSpacing = parseCSSNumber(pickStyle(style, 'row-gap')) ?? 0
  const inFlow = items.filter(({ layer }) => layer.layoutPositioning !== 'ABSOLUTE')
  const lone = inFlow.length === 1 ? inFlow[0] : undefined
  const down =
    contentSide(style, 'align-content') ?? (lone ? itemSide(lone.style, style, 'align') : null)
  if (down) grid.primaryAxisAlign = down
  const tracks = contentSide(style, 'justify-content')
  const fills = column === 'fr' || (column === 'auto' ? !tracks : column === contentWidth(style))
  const loneWidth = lone ? parseCSSNumber(pickStyle(lone.style, 'width')) : null
  if (!fills && !(lone && (column === 'auto' || loneWidth === column))) return
  for (const { layer, style: itemStyle } of inFlow) {
    const across = fills ? itemSide(itemStyle, style, 'justify') : (tracks ?? 'MIN')
    if (!across) continue
    if (layer.layoutAlignSelf === 'STRETCH') {
      Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', 'HUG'))
    }
    layer.layoutAlignSelf = across
  }
}
