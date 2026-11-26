import type { SceneGraph } from '../graph'
import type { Rect, Vector } from '../primitives'
import type { SceneNode } from '../types'

/** Where moved slides go: beside a slide, or as a new section before another one or at the end. */
export type SlidePlacement =
  | { type: 'beside'; slideId: string; side: 'before' | 'after' }
  | { type: 'section'; before: string | null }

/** The line that shows where a drop lands, in canvas units. */
export interface SlideDropLine {
  x: number
  y: number
  length: number
  direction: 'HORIZONTAL' | 'VERTICAL'
}

export interface SlideDrop {
  placement: SlidePlacement
  line: SlideDropLine
}

function boxOf(graph: SceneGraph, node: SceneNode): Rect {
  const { x, y } = graph.getAbsolutePosition(node.id)
  return { x, y, width: node.width, height: node.height }
}

function distanceTo(box: Rect, point: Vector): number {
  const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.width)
  const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.height)
  return Math.hypot(dx, dy)
}

/** Beside the slide of `row` nearest the point, on the side of its middle the point is on. */
function besideNearest(graph: SceneGraph, row: SceneNode, point: Vector): SlideDrop | null {
  const slides = graph
    .getChildren(row.id)
    .filter((node) => node.type === 'SLIDE')
    .map((slide) => ({ slide, box: boxOf(graph, slide) }))
  let nearest = slides.at(0)
  for (const candidate of slides) {
    if (nearest && distanceTo(candidate.box, point) < distanceTo(nearest.box, point)) {
      nearest = candidate
    }
  }
  if (!nearest) return null
  const { slide, box } = nearest
  const side = point.x < box.x + box.width / 2 ? 'before' : 'after'
  const half = row.itemSpacing / 2
  return {
    placement: { type: 'beside', slideId: slide.id, side },
    line: {
      x: side === 'before' ? box.x - half : box.x + box.width + half,
      y: box.y,
      length: box.height,
      direction: 'VERTICAL'
    }
  }
}

/**
 * Where slides dragged to a point on the page's deck land, as in Figma's grid: in a section's band,
 * beside its nearest slide; between sections, above the first, or below the last, as a new section
 * there. Null on a page without a deck.
 */
export function slideDropAt(graph: SceneGraph, pageId: string, point: Vector): SlideDrop | null {
  const grid = graph.getChildren(pageId).find((node) => node.type === 'SLIDE_GRID')
  if (!grid) return null
  const rows = graph
    .getChildren(grid.id)
    .filter((node) => node.type === 'SLIDE_ROW')
    .map((row) => ({ row, box: boxOf(graph, row) }))
  const within = rows.find(({ box }) => point.y >= box.y && point.y <= box.y + box.height)
  if (within) return besideNearest(graph, within.row, point)

  const index = rows.findIndex(({ box }) => point.y < box.y)
  const next = index === -1 ? undefined : rows[index]
  const previous = index === -1 ? rows.at(-1) : rows[index - 1]
  const half = grid.itemSpacing / 2
  const gridBox = boxOf(graph, grid)
  let y = gridBox.y + grid.paddingTop - half
  if (previous && next) y = (previous.box.y + previous.box.height + next.box.y) / 2
  else if (previous) y = previous.box.y + previous.box.height + half
  else if (next) y = next.box.y - half
  return {
    placement: { type: 'section', before: next?.row.id ?? null },
    line: {
      x: gridBox.x + grid.paddingLeft,
      y,
      length: gridBox.width - grid.paddingLeft - grid.paddingRight,
      direction: 'HORIZONTAL'
    }
  }
}
