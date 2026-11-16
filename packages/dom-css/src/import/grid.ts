import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
  parseCSSGridTracks,
  parseCSSJustifyContent,
  parseCSSNumber
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
 * columns.
 */
function singleColumn(style: DesignStyleDeclaration): 'auto' | 'fr' | number | null {
  const columns = parseCSSGridTracks(pickStyle(style, 'grid-template-columns') ?? 'none')
  if (columns.length !== 1) return null
  const [track] = columns
  if (track.sizing === 'FR') return 'fr'
  return track.sizing === 'FIXED' ? track.value : 'auto'
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
 * builds: `align-content` packs its rows at the top, middle, or bottom, and a lone item in a
 * grid of one row, which fills it, takes its own `align-self` or the grid's `align-items` too.
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
  const down = sideDown(style, lone)
  if (down) grid.primaryAxisAlign = down
  alignAcross(graph, inFlow, style, column, lone)
}

/**
 * Where the rows go down: by `align-content`, or for a lone item in a grid of one row or none,
 * whose row fills the grid, by its own alignment.
 */
function sideDown(style: DesignStyleDeclaration, lone: FlowBlock | undefined): Side | null {
  const rows = parseCSSGridTracks(pickStyle(style, 'grid-template-rows') ?? 'none')
  const fromItem = lone && rows.length === 1 ? itemSide(lone.style, style, 'align') : null
  return contentSide(style, 'align-content') ?? fromItem
}

/** Puts each item across its column, where a stack can hold it; see `alignGridItems`. */
function alignAcross(
  graph: SceneGraph,
  items: readonly FlowBlock[],
  style: DesignStyleDeclaration,
  column: 'auto' | 'fr' | number,
  lone: FlowBlock | undefined
): void {
  const tracks = contentSide(style, 'justify-content')
  const fills = column === 'fr' || (column === 'auto' ? !tracks : column === contentWidth(style))
  const loneWidth = lone ? parseCSSNumber(pickStyle(lone.style, 'width')) : null
  if (!fills && !(lone && (column === 'auto' || loneWidth === column))) return
  for (const { layer, style: itemStyle } of items) {
    const across = fills ? itemSide(itemStyle, style, 'justify') : (tracks ?? 'MIN')
    if (!across) continue
    if (layer.layoutAlignSelf === 'STRETCH') {
      Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', 'HUG'))
    }
    layer.layoutAlignSelf = across
  }
}
