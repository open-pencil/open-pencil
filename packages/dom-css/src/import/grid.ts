import type { GridTrack, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSAlignItems,
  parseCSSAlignSelf,
  parseCSSGridTracks,
  parseCSSJustifyContent,
  parseCSSNumber,
  splitCSSValue
} from '@open-pencil/scene-graph/css'
import { layoutSizingUpdates } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { contentInsets } from './box'
import { pickStyle } from './css-values'
import type { FlowBlock } from './flow'
import type { CapturedBoxes } from './placement'

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
  style: DesignStyleDeclaration,
  boxes: CapturedBoxes
): void {
  if (grid.layoutMode !== 'VERTICAL') return
  const column = singleColumn(style)
  if (column === null) {
    layOutGridTracks(graph, grid, items, style, boxes)
    return
  }
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

/** How an item takes its grid area along one axis: stretched over it, or at its start. */
type CellFit = 'stretch' | 'start'

/**
 * How an item takes its area along an axis by its own alignment, or its grid's for `auto`:
 * `normal` stretches it, as `legacy` does a block, and `start` keeps it at the start. Null for an
 * alignment that moves it within the area, which a grid layer cannot hold.
 */
function cellFit(
  item: DesignStyleDeclaration,
  container: DesignStyleDeclaration,
  property: 'align' | 'justify'
): CellFit | null {
  const own = parseCSSAlignSelf(pickStyle(item, `${property}-self`))
  const align = own !== undefined && own !== 'AUTO' ? own : gridAlign(container, property)
  if (align === 'STRETCH') return 'stretch'
  return align === 'MIN' ? 'start' : null
}

/** A grid's alignment of its items along an axis; `normal`, and `legacy` for a block, stretch them. */
function gridAlign(container: DesignStyleDeclaration, property: 'align' | 'justify') {
  const value = pickStyle(container, `${property}-items`)?.trim().toLowerCase()
  if (!value || value === 'legacy') return 'STRETCH'
  return parseCSSAlignItems(value)
}

/** The start of each track, from the start of the first, `gap` apart; null unless all are fixed. */
function trackStarts(tracks: readonly GridTrack[], gap: number): number[] | null {
  if (tracks.some((track) => track.sizing !== 'FIXED')) return null
  const starts: number[] = []
  let at = 0
  for (const track of tracks) {
    starts.push(at)
    at += track.value + gap
  }
  return starts
}

/** How close a box's edge may sit to a track's to start there, in CSS pixels. */
const TRACK_EDGE = 1

/** The first track a span starts in, 1-based, and how many it covers, by where it was laid out. */
function trackSpan(starts: readonly number[], start: number, end: number) {
  const first = starts.findLastIndex((at) => at <= start + TRACK_EDGE)
  const last = starts.findLastIndex((at) => at < end - TRACK_EDGE)
  return { track: Math.max(first, 0) + 1, span: Math.max(last - first, 0) + 1 }
}

type GridLine = { line: number } | { span: number }

/**
 * A grid line a placement property names by number alone: a line, or a span of tracks. Null for
 * `auto`, a line name, or a number counted among named lines, as in `2 foo`, which counts only
 * the lines of that name.
 */
function gridLine(value: string | undefined): GridLine | null {
  const words = splitCSSValue(value?.trim().toLowerCase() ?? '')
  const isSpan = words[0] === 'span'
  if (words.length !== (isSpan ? 2 : 1)) return null
  const count = Number(words.at(-1))
  if (!Number.isInteger(count) || count < 1) return null
  return isSpan ? { span: count } : { line: count }
}

/**
 * The start track and span an item's `grid-column-*` or `grid-row-*` declare by number, as CSS
 * Grid §8.3.1 resolves them: two lines in either order bound the area, a span on the start wins
 * over one on the end, and a span against a line counts back or on from it. A span shows how
 * many tracks an item at the start of its area covers, which its box does not; what is left
 * undeclared, or named, its box fills in.
 */
function declaredArea(
  item: DesignStyleDeclaration,
  axis: 'column' | 'row'
): { track?: number; span?: number } {
  const start = gridLine(pickStyle(item, `grid-${axis}-start`))
  const end = gridLine(pickStyle(item, `grid-${axis}-end`))
  const startLine = start && 'line' in start ? start.line : null
  const endLine = end && 'line' in end ? end.line : null
  const spanOf = (line: GridLine | null) => (line && 'span' in line ? line.span : null)
  const span = spanOf(start) ?? spanOf(end)
  if (startLine !== null && endLine !== null && startLine !== endLine) {
    return { track: Math.min(startLine, endLine), span: Math.abs(endLine - startLine) }
  }
  if (startLine !== null) return span === null ? { track: startLine } : { track: startLine, span }
  if (endLine !== null && span !== null) return { track: Math.max(1, endLine - span), span }
  return span === null ? {} : { span }
}

/**
 * Lays a grid of several columns out as a grid layer (CSS Grid §7): its tracks as the page
 * resolved them, its gaps, and each item in the area the page placed it in: by the lines it
 * declares by number, else read from where it was laid out. An item that stretches over its
 * area fills it; one at the start with a size of its own keeps it, or hugs its content. A grid
 * whose alignment moves items within their areas, or its tracks within it, stays a stack, and
 * placement puts its items.
 */
function layOutGridTracks(
  graph: SceneGraph,
  grid: SceneNode,
  items: readonly FlowBlock[],
  style: DesignStyleDeclaration,
  boxes: CapturedBoxes
): void {
  const columns = parseCSSGridTracks(pickStyle(style, 'grid-template-columns') ?? 'none')
  const rows = parseCSSGridTracks(pickStyle(style, 'grid-template-rows') ?? 'none')
  if (columns.length < 2) return
  const movesTracks = (property: string) => {
    const tracks = contentSide(style, property)
    return tracks !== null && tracks !== 'MIN'
  }
  if (movesTracks('justify-content') || movesTracks('align-content')) return
  const inFlow = items.filter(({ layer }) => layer.layoutPositioning !== 'ABSOLUTE')
  const fits = inFlow.map(({ style: item }) => ({
    across: cellFit(item, style, 'justify'),
    down: cellFit(item, style, 'align')
  }))
  if (fits.some(({ across, down }) => !across || !down)) return

  const columnGap = parseCSSNumber(pickStyle(style, 'column-gap')) ?? 0
  const rowGap = parseCSSNumber(pickStyle(style, 'row-gap')) ?? 0
  Object.assign(grid, {
    layoutMode: 'GRID',
    gridTemplateColumns: columns,
    gridTemplateRows: rows,
    gridColumnGap: columnGap,
    gridRowGap: rowGap
  })
  const own = boxes.get(grid.id)?.box
  if (own) {
    grid.width = own.width
    grid.height = own.height
  }
  const insets = contentInsets(style)
  const columnStarts = trackStarts(columns, columnGap)
  const rowStarts = trackStarts(rows, rowGap)
  inFlow.forEach(({ layer, style: item }, index) => {
    const { across, down } = fits[index]
    const size = (axis: 'width' | 'height', fit: CellFit | null) => {
      if (fit === 'stretch' && parseCSSNumber(pickStyle(item, axis)) === null) return 'FILL'
      return parseCSSNumber(pickStyle(item, axis)) === null ? 'HUG' : 'FIXED'
    }
    Object.assign(layer, layoutSizingUpdates(graph, layer, 'HORIZONTAL', size('width', across)))
    Object.assign(layer, layoutSizingUpdates(graph, layer, 'VERTICAL', size('height', down)))
    const box = boxes.get(layer.id)?.box
    if (!own || !box || !columnStarts || !rowStarts) return
    const x = box.x - own.x - insets.left
    const y = box.y - own.y - insets.top
    const column = { ...trackSpan(columnStarts, x, x + box.width), ...declaredArea(item, 'column') }
    const row = { ...trackSpan(rowStarts, y, y + box.height), ...declaredArea(item, 'row') }
    layer.gridPosition = {
      column: column.track,
      columnSpan: column.span,
      row: row.track,
      rowSpan: row.span
    }
  })
}
