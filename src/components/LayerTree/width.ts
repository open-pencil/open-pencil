import type { LayerRow } from '@open-pencil/vue/primitives/LayerTree'

export interface LayerRowMetrics {
  /** The names' font and the variable mode badges' font, as canvas `font` strings. */
  font: string
  badgeFont: string
  indent: number
  /** From a row's indent to the start of its name: disclosure, icon, and their gaps. */
  nameStart: number
  /** The buttons at a row's end, with their gap and the row's end padding. */
  buttons: number
  /** Space a variable mode badge takes besides its text, and an issue mark with its gap. */
  badge: number
  issueMark: number
  /** The list's own width, which rows fill before they scroll. */
  viewportWidth: number
}

export interface LayerRowDecorations {
  modeNames: (row: LayerRow) => readonly string[]
  /** Whether the row shows an issue mark; `expanded` is whether its children are listed. */
  showsIssue: (row: LayerRow, expanded: boolean) => boolean
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

/**
 * How far the layer rows reach past the list sideways, as in Figma's layers panel: far enough
 * for the widest row's indent, whole name, mode badges, and issue mark, so no name is ever cut
 * short, only scrolled out of view.
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
    for (const name of decorations.modeNames(row)) {
      width += metrics.badge + measure(name, metrics.badgeFont)
    }
    const expanded = row.hasChildren && (rows[index + 1]?.level ?? 0) > row.level
    if (decorations.showsIssue(row, expanded)) width += metrics.issueMark
    if (width > widest) widest = width
  }
  return Math.max(0, Math.ceil(widest + metrics.buttons - metrics.viewportWidth))
}
