import { sum } from 'es-toolkit'

import type { LayerRow } from '@open-pencil/vue/primitives/LayerTree'

export interface LayerRowMetrics {
  /** The names' font and the variable mode badges' font, as canvas `font` strings. */
  font: string
  badgeFont: string
  indent: number
  /** From a row's indent to the start of its name: disclosure, icon, and their gaps. */
  nameStart: number
  /** Space a variable mode badge takes besides its text. */
  badge: number
  rowEnd: number
  trailingGap: number
  issueMark: number
  buttons: number
  /** The list's own width, which rows fill before they scroll. */
  viewportWidth: number
}

export interface LayerRowDecorations {
  modeCount: (row: LayerRow) => number
  /** Whether the row shows an issue mark; `expanded` is whether its children are listed. */
  showsIssue: (row: LayerRow, expanded: boolean) => boolean
  buttonsAlwaysShown: (row: LayerRow) => boolean
}

/** Text widths in a font, measured once each on a canvas. */
export function createTextMeasure() {
  let context: CanvasRenderingContext2D | null = null
  const widths = new Map<string, number>()
  return (text: string, font: string): number => {
    const key = `${font}\n${text}`
    let width = widths.get(key)
    if (width === undefined) {
      context ??= document.createElement('canvas').getContext('2d')
      if (!context) return 0
      context.font = font
      width = context.measureText(text).width
      widths.set(key, width)
    }
    return width
  }
}

function trailingWidth(parts: readonly number[], metrics: LayerRowMetrics): number {
  return sum(parts) + metrics.trailingGap * Math.max(0, parts.length - 1) + metrics.rowEnd
}

/**
 * How far the layer rows reach past the list sideways, as in Figma's layers panel: far enough for
 * the widest idle row's indent, whole name, compact mode badge, issue mark, and the buttons a
 * locked or hidden layer always shows. Buttons that show only on hover cut the name instead.
 */
export function rowsOverflow(
  rows: readonly LayerRow[],
  metrics: LayerRowMetrics,
  decorations: LayerRowDecorations,
  measure: (text: string, font: string) => number
): number {
  if (!metrics.font) return 0
  let widest = 0
  for (const [index, row] of rows.entries()) {
    let width = (row.level - 1) * metrics.indent + metrics.nameStart
    width += measure(row.node.name, metrics.font)
    const modeCount = decorations.modeCount(row)
    if (modeCount > 0) {
      width += metrics.badge + measure(String(modeCount), metrics.badgeFont)
    }
    const expanded = row.hasChildren && (rows[index + 1]?.level ?? 0) > row.level
    const trailing: number[] = []
    if (decorations.showsIssue(row, expanded)) {
      trailing.push(metrics.issueMark)
    }
    if (decorations.buttonsAlwaysShown(row)) {
      trailing.push(metrics.buttons)
    }
    width += trailingWidth(trailing, metrics)
    if (width > widest) {
      widest = width
    }
  }
  return Math.max(0, Math.ceil(widest - metrics.viewportWidth))
}
