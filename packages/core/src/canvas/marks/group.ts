import type { Rect } from '@open-pencil/scene-graph/primitives'

/** Something drawn over the canvas at a screen rectangle, such as an issue marker or a comment pin. */
export interface ScreenMark<T> {
  item: T
  rect: Rect
}

/** Marks shown as one: the items in the order they joined, and where the group sits. */
export interface MarkGroup<T> {
  items: [T, ...T[]]
  rect: Rect
}

/** Whether two screen rectangles come within `gap` of each other. */
export function marksOverlap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  )
}

/**
 * Gathers marks that would crowd each other on the screen into groups, as zoomed-out issue
 * markers and comment pins are. Marks arrive in priority order; each joins the first group it
 * comes within `gap` of, or starts its own. A group sits at its first mark's rectangle unless
 * `place` moves it as marks join, such as a count badge growing wider or a cluster centering on
 * its members, and later marks are measured against where it is now.
 */
export function groupMarks<T>(
  marks: Iterable<ScreenMark<T>>,
  gap: number,
  place?: (items: readonly [T, ...T[]]) => Rect
): MarkGroup<T>[] {
  const groups: MarkGroup<T>[] = []
  for (const { item, rect } of marks) {
    const group = groups.find((existing) => marksOverlap(existing.rect, rect, gap))
    if (!group) {
      groups.push({ items: [item], rect })
      continue
    }
    group.items.push(item)
    if (place) group.rect = place(group.items)
  }
  return groups
}
