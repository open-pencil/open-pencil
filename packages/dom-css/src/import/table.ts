import type { SceneNode } from '@open-pencil/scene-graph'

import type { DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'

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
  if (pickStyle(style, 'border-collapse')?.trim() === 'collapse') return { across: 0, down: 0 }
  const [across = 0, down = across] = (pickStyle(style, 'border-spacing') ?? '')
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value))
  return { across, down }
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
