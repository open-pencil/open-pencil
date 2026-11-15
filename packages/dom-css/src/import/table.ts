import { groupBy, partition, pick } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { maxOf, minOf } from '@open-pencil/scene-graph/arrays'
import { parseCSSNumber, splitCSSValue } from '@open-pencil/scene-graph/css'
import { autoLayoutSizingFields, layoutSizingUpdates } from '@open-pencil/scene-graph/layout'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { borderWidths } from './box'
import { mergedStyle, pickStyle } from './css-values'
import type { FlowBlock } from './flow'
import type { CapturedBoxes } from './placement'

/** Boxes that hold a table's rows, one above the other. */
const ROW_GROUPS = new Set(['table-row-group', 'table-header-group', 'table-footer-group'])

/**
 * Whether the display describes a table's columns rather than holding content: columns size
 * the cells under them, so they become no layers of their own.
 */
export function isTableColumn(display: string): boolean {
  return display === 'table-column' || display === 'table-column-group'
}

/** Whether the display makes a table, block-level or inline-level. */
export function isTable(display: string): boolean {
  return display === 'table' || display === 'inline-table'
}

/** Whether the display lays its children out as a table row lays out its cells, side by side. */
export function isTableRow(display: string): boolean {
  return display === 'table-row'
}

/**
 * The space `border-spacing` puts between cells, and between them and the table's edges:
 * across, then down. Collapsed borders have none.
 */
function borderSpacing(style: DesignStyleDeclaration): { across: number; down: number } {
  if (collapsesBorders(style)) return { across: 0, down: 0 }
  const [across = 0, down = across] = splitCSSValue(pickStyle(style, 'border-spacing') ?? '').map(
    (part) => parseCSSNumber(part) ?? 0
  )
  return { across, down }
}

/** Whether a table, or a part of one, collapses its cells' borders into the borders they share. */
export function collapsesBorders(style: DesignStyleDeclaration): boolean {
  return pickStyle(style, 'border-collapse')?.trim() === 'collapse'
}

/** The first cell of a table, through its row groups and rows, in document order. */
function firstCell(element: DesignElement): DesignElement | undefined {
  for (const child of element.children) {
    if (child.type !== 'element') continue
    const display = pickStyle(mergedStyle(child), 'display')?.trim() ?? ''
    if (display === 'table-cell') return child
    if (ROW_GROUPS.has(display) || isTableRow(display) || display === 'contents') {
      const cell = firstCell(child)
      if (cell) return cell
    }
  }
  return undefined
}

/**
 * Lays collapsed borders out as CSS does (CSS 2.1 §17.6.2): cells touch, each holding half of
 * every border it shares, so a cell's border is a centered stroke that draws one line with its
 * neighbour's, and its content sits inside half of it. The table holds the outer half of the
 * outer borders. Its borders are its first cell's, as the HTML engine lays every collapsed border
 * out with, so a table whose cells differ is still placed where it was laid out.
 */
export function applyCollapsedBorders(
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration,
  display: string
): void {
  if (!collapsesBorders(style)) return
  if (display === 'table-cell') {
    if (node.strokes.length === 0) return
    node.strokes = node.strokes.map((stroke) => ({ ...stroke, align: 'CENTER' }))
    const half = borderWidths(style)
    node.paddingTop += half.top / 2
    node.paddingRight += half.right / 2
    node.paddingBottom += half.bottom / 2
    node.paddingLeft += half.left / 2
    return
  }
  if (display !== 'table' && display !== 'inline-table') return
  const cell = firstCell(element)
  if (!cell) return
  const borders = borderWidths(mergedStyle(cell))
  const across = Math.max(borders.left, borders.right) / 2
  const down = Math.max(borders.top, borders.bottom) / 2
  if (across === 0 && down === 0) return
  // A collapsed table has no padding, and its own border is one of those its cells collapse.
  node.strokesIncludedInLayout = false
  node.paddingTop = down
  node.paddingBottom = down
  node.paddingLeft = across
  node.paddingRight = across
}

/** Where `vertical-align` puts a cell's content in the height of its row. */
function cellContentAlign(style: DesignStyleDeclaration): SceneNode['primaryAxisAlign'] {
  const align = pickStyle(style, 'vertical-align')?.trim()
  if (align === 'middle') return 'CENTER'
  return align === 'bottom' ? 'MAX' : 'MIN'
}

/**
 * The auto layout a table part adds to its flow: the table and its row groups stack rows with
 * the spacing between them, the table keeps that spacing at its edges too, a row puts it
 * between its cells, and a cell places its content by `vertical-align`. A row is laid out as a
 * flex row, so its cells stretch to its height as they do in a table.
 */
export function applyTableLayout(
  node: SceneNode,
  style: DesignStyleDeclaration,
  display: string
): void {
  if (display === 'table-cell') {
    node.primaryAxisAlign = cellContentAlign(style)
    return
  }
  const spacing = borderSpacing(style)
  if (display === 'table' || display === 'inline-table') {
    node.itemSpacing = spacing.down
    node.paddingTop += spacing.down
    node.paddingBottom += spacing.down
    node.paddingLeft += spacing.across
    node.paddingRight += spacing.across
  } else if (ROW_GROUPS.has(display)) {
    node.itemSpacing = spacing.down
  } else if (isTableRow(display)) {
    node.itemSpacing = spacing.across
  }
}

/** What the table box draws and lays its rows out with, which its captions sit outside of. */
const GRID_BOX_FIELDS = [
  'layoutMode',
  'primaryAxisAlign',
  'counterAxisAlign',
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fills',
  'strokes',
  'strokesIncludedInLayout',
  'dashPattern',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'effects',
  'cornerRadius',
  'independentCorners',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'clipsContent'
] as const satisfies readonly (keyof SceneNode)[]

/**
 * A table with captions as CSS boxes it (CSS 2.1 §17.4): a wrapper stacks the captions, by
 * `caption-side`, around the table box, which takes the table's borders, background, padding,
 * and spacing and holds its rows. The table's layer stays the wrapper, placed and sized as the
 * table is, and the table box becomes a layer inside it that fills its width.
 */
export function wrapTableGrid(
  graph: SceneGraph,
  table: SceneNode,
  parts: FlowBlock[],
  boxes: CapturedBoxes
): void {
  const captions = parts.filter(
    ({ style }) => pickStyle(style, 'display')?.trim() === 'table-caption'
  )
  const mode = table.layoutMode
  if (captions.length === 0 || (mode !== 'VERTICAL' && mode !== 'HORIZONTAL')) return
  const grid = graph.createNode('FRAME', table.id, { name: 'table box', clipsContent: false })
  const box = pick(table, GRID_BOX_FIELDS)
  Object.assign(table, pick(grid, GRID_BOX_FIELDS), { layoutMode: 'VERTICAL' })
  Object.assign(grid, box, autoLayoutSizingFields(mode, 'HUG', 'HUG'))
  Object.assign(grid, layoutSizingUpdates(graph, grid, 'HORIZONTAL', 'FILL'))
  const captionIds = new Set(captions.map(({ layer }) => layer.id))
  for (const child of graph.getChildren(table.id)) {
    if (child.id !== grid.id && !captionIds.has(child.id)) graph.reparentNode(child.id, grid.id)
  }
  const [below, above] = partition(
    captions,
    ({ style }) => pickStyle(style, 'caption-side')?.trim() === 'bottom'
  )
  const order = [
    ...above.map(({ layer }) => layer.id),
    grid.id,
    ...below.map(({ layer }) => layer.id)
  ]
  order.forEach((id, index) => graph.insertChildAt(id, table.id, index))
  // A lone caption keeps its margin from the table box, as the gap between them.
  if (captions.length === 1) {
    const [{ style }] = captions
    table.itemSpacing = margin(style, below.length === 1 ? 'top' : 'bottom')
  }
  // The table box lies between the captions and their margins, where placement puts it if auto
  // layout cannot.
  const wrapper = boxes.get(table.id)?.box
  if (!wrapper) return
  const edge = (side: FlowBlock[], at: (box: Rect, style: DesignStyleDeclaration) => number) =>
    side.flatMap(({ layer, style }) => {
      const box = boxes.get(layer.id)?.box
      return box ? [at(box, style)] : []
    })
  const top = maxOf([
    wrapper.y,
    ...edge(above, (box, style) => box.y + box.height + margin(style, 'bottom'))
  ])
  const bottom = minOf([
    wrapper.y + wrapper.height,
    ...edge(below, (box, style) => box.y - margin(style, 'top'))
  ])
  boxes.set(grid.id, { box: { x: wrapper.x, y: top, width: wrapper.width, height: bottom - top } })
}

/** A box's margin on one side, in pixels; none for `auto` or a percentage. */
function margin(style: DesignStyleDeclaration, side: 'top' | 'bottom'): number {
  return Math.max(0, parseCSSNumber(pickStyle(style, `margin-${side}`)) ?? 0)
}

/** How many rows a cell spans, by its `rowspan` attribute (HTML §4.9.11), at least one. */
function rowSpan(cell: DesignElement): number {
  const span = Number.parseInt(cell.attrs.rowspan ?? '', 10)
  return Number.isNaN(span) ? 1 : Math.max(span, 1)
}

/**
 * Lays a row out around cells that span rows below it: such a cell takes no room in the row's
 * flow and keeps the box the page gave it, reaching down past the row, and the row's padding
 * keeps its other cells off the slots that cells from rows above cover at its start and end.
 * Slots covered between two cells have no such room, and placement puts the row's cells.
 */
export function layOutRowSpans(row: SceneNode, cells: FlowBlock[], boxes: CapturedBoxes): void {
  const rowBox = boxes.get(row.id)?.box
  if (!rowBox || row.layoutMode !== 'HORIZONTAL') return
  for (const { layer, element } of cells) {
    const box = boxes.get(layer.id)?.box
    if (rowSpan(element) === 1 || !box) continue
    layer.layoutPositioning = 'ABSOLUTE'
    Object.assign(layer, {
      x: box.x - rowBox.x,
      y: box.y - rowBox.y,
      width: box.width,
      height: box.height
    })
    if (layer.layoutMode === 'HORIZONTAL' || layer.layoutMode === 'VERTICAL') {
      Object.assign(layer, autoLayoutSizingFields(layer.layoutMode, 'FIXED', 'FIXED'))
    }
  }
  const flow = cells.flatMap(({ layer }) => {
    const box = boxes.get(layer.id)?.box
    return box && layer.layoutPositioning !== 'ABSOLUTE' ? [box] : []
  })
  if (flow.length === 0) return
  row.paddingLeft = Math.max(0, minOf(flow.map((box) => box.x)) - rowBox.x)
  row.paddingRight = Math.max(
    0,
    rowBox.x + rowBox.width - maxOf(flow.map((box) => box.x + box.width))
  )
}

type Side = 'borderTopWeight' | 'borderRightWeight' | 'borderBottomWeight' | 'borderLeftWeight'

/** How close two laid-out edges are to count as one, in CSS pixels. */
const SHARED_EDGE = 0.5

/** Whether two spans along an edge overlap by more than a point. */
function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return Math.min(end, otherEnd) - Math.max(start, otherStart) > SHARED_EDGE
}

/**
 * Draws each border two cells of a collapsed table share once, as CSS paints the one border that
 * wins the conflict between them (CSS 2.1 §17.6.2.1): the wider, or on a tie the one to the left
 * or above. The other cell's side draws nothing, so a translucent border is not painted twice;
 * its content keeps the half of the border it holds.
 */
export function paintSharedBordersOnce(cells: readonly SceneNode[], boxes: CapturedBoxes): void {
  const placed = cells.flatMap((cell) => {
    const box = boxes.get(cell.id)?.box
    return box ? [{ cell, box }] : []
  })
  const byEdge = (edge: (box: Rect) => number) =>
    groupBy(placed, ({ box }) => String(Math.round(edge(box))))
  const byLeft = byEdge((box) => box.x)
  const byTop = byEdge((box) => box.y)
  // A bordered cell has a weight on each side, which the importer sets from its border.
  const drop = (cell: SceneNode, side: Side) => {
    cell[side] = 0
    cell.independentStrokeWeights = true
  }
  for (const { cell, box } of placed) {
    const right = box.x + box.width
    const bottom = box.y + box.height
    for (const next of byLeft[String(Math.round(right))] ?? []) {
      if (Math.abs(next.box.x - right) > SHARED_EDGE) continue
      if (!overlaps(box.y, bottom, next.box.y, next.box.y + next.box.height)) continue
      if (next.cell.borderLeftWeight > cell.borderRightWeight) drop(cell, 'borderRightWeight')
      else drop(next.cell, 'borderLeftWeight')
    }
    for (const next of byTop[String(Math.round(bottom))] ?? []) {
      if (Math.abs(next.box.y - bottom) > SHARED_EDGE) continue
      if (!overlaps(box.x, right, next.box.x, next.box.x + next.box.width)) continue
      if (next.cell.borderTopWeight > cell.borderBottomWeight) drop(cell, 'borderBottomWeight')
      else drop(next.cell, 'borderTopWeight')
    }
  }
}
