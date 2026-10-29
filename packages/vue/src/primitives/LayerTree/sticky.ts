import type { LayerRow } from '#vue/primitives/LayerTree/context'

export interface StickyLayerRow {
  /** The pinned row's index among the visible rows. */
  index: number
  /** How far up, in pixels, the next top-level row pushes it; 0 or less. */
  offset: number
}

/**
 * The top-level row the layers panel pins while you scroll through its children, as Figma's
 * does: one row at a time, the last top-level row at or above the first visible one, and only
 * while it is expanded with its children showing and its own row has scrolled off the top. The
 * next top-level row pushes it up as it arrives. Null when nothing is pinned.
 */
export function stickyTopLevelRow(
  rows: readonly LayerRow[],
  scrollTop: number,
  rowHeight: number
): StickyLayerRow | null {
  if (rows.length === 0 || scrollTop <= 0 || rowHeight <= 0) return null
  const firstVisible = Math.min(Math.floor(scrollTop / rowHeight), rows.length - 1)
  let index = -1
  for (let i = firstVisible; i >= 0; i--) {
    if (rows[i].level === 1) {
      index = i
      break
    }
  }
  if (index === -1) return null
  const expanded = rows[index].hasChildren && (rows[index + 1]?.level ?? 1) > 1
  // Still in full view at the top: nothing to pin yet.
  if (!expanded || index * rowHeight >= scrollTop) return null

  let next = -1
  for (let i = index + 1; i < rows.length; i++) {
    if (rows[i].level === 1) {
      next = i
      break
    }
  }
  const offset = next === -1 ? 0 : Math.min(0, (next - 1) * rowHeight - scrollTop)
  return { index, offset }
}
