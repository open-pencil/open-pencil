import type { SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber, splitCSSValue } from '@open-pencil/scene-graph/css'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { borderWidths } from './box'
import { mergedStyle, pickStyle } from './css-values'

/** Boxes that hold a table's rows, one above the other. */
const ROW_GROUPS = new Set(['table-row-group', 'table-header-group', 'table-footer-group'])

/**
 * Whether the display describes a table's columns rather than holding content: columns size
 * the cells under them, so they become no layers of their own.
 */
export function isTableColumn(display: string): boolean {
  return display === 'table-column' || display === 'table-column-group'
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
