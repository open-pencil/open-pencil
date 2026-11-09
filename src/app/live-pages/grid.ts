import type { Vector } from '@open-pencil/scene-graph/primitives'

/** How many pages one row of the grid holds. */
export const PAGE_COLUMNS = 3
/** Room between two pages, so their frames never touch. */
export const PAGE_GAP = 80

/**
 * Where the page at `index` starts on a page of the document: pages fill a row left to right and
 * the rows go down, each frame as wide as the page it shows.
 */
export function gridPosition(index: number, width: number, height: number): Vector {
  const column = index % PAGE_COLUMNS
  const row = Math.floor(index / PAGE_COLUMNS)
  return { x: column * (width + PAGE_GAP), y: row * (height + PAGE_GAP) }
}
