import type { LayerRow } from '@open-pencil/vue/primitives/LayerTree'

export interface LayerRowMetrics {
  /** The tree's label font, as `getComputedStyle(…).font` gives it. */
  font: string
  indent: number
  /** From a row's indent to the start of its name: disclosure, icon, and their gaps. */
  nameStart: number
  /** The buttons at a row's end, with their gap and the row's end padding. */
  buttons: number
  /** The list's own width, which rows fill before they scroll. */
  viewportWidth: number
}

/**
 * How far the layer rows reach past the list sideways, as in Figma's layers panel: far enough
 * for the widest row's indent and whole name, so no name is ever cut short, only scrolled out of
 * view. Name widths are measured once per font; the result is kept until the rows or metrics
 * change, since the tree renders far more often than it changes.
 */
export function createRowsOverflow() {
  let context: CanvasRenderingContext2D | null = null
  const widths = new Map<string, number>()
  let measuredFont = ''
  let last: { rows: readonly LayerRow[]; key: string; overflow: number } | null = null

  function nameWidth(name: string): number {
    let width = widths.get(name)
    if (width === undefined) {
      context ??= document.createElement('canvas').getContext('2d')
      if (!context) return 0
      context.font = measuredFont
      width = context.measureText(name).width
      widths.set(name, width)
    }
    return width
  }

  return (rows: readonly LayerRow[], metrics: LayerRowMetrics): number => {
    const key = JSON.stringify(metrics)
    if (last?.rows === rows && last.key === key) return last.overflow
    if (metrics.font !== measuredFont) {
      widths.clear()
      measuredFont = metrics.font
    }
    let widest = 0
    if (metrics.font) {
      for (const row of rows) {
        const width =
          (row.level - 1) * metrics.indent + metrics.nameStart + nameWidth(row.node.name)
        if (width > widest) widest = width
      }
    }
    const overflow = Math.max(0, Math.ceil(widest + metrics.buttons - metrics.viewportWidth))
    last = { rows, key, overflow }
    return overflow
  }
}
