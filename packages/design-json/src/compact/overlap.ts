import type { Draft } from '#design-json/compact/tree'
import { groupBy } from 'es-toolkit'

import type { Rect } from '@open-pencil/scene-graph/primitives'
import { maxOf, minOf } from '@open-pencil/std/arrays'

/**
 * Sibling layers as a person reading the design would nest them: a layer drawn wholly inside one
 * below it becomes that layer's child, and layers that still overlap are grouped. Siblings are in
 * drawing order, the first at the bottom.
 */
export function inferNesting(siblings: Draft[]): Draft[] {
  return groupOverlapping(nestContained(siblings))
}

/** Moves each layer drawn wholly inside one below it into the smallest such layer. */
function nestContained(siblings: Draft[]): Draft[] {
  const containers = siblings.map((_, index) => containerOf(siblings, index))
  siblings.forEach((draft, index) => adoptInto(containers[index], draft))
  return siblings.filter((_, index) => containers[index] === null)
}

function adoptInto(container: Draft | null, draft: Draft) {
  if (!container) return
  draft.layer.inferred = 'contained'
  container.children.push(draft)
}

/** The smallest layer below the one at `index` that holds it whole; text holds nothing. */
function containerOf(siblings: readonly Draft[], index: number): Draft | null {
  const inner = siblings[index].bounds
  const holders = siblings
    .slice(0, index)
    .filter((below) => below.layer.kind !== 'text' && contains(below.bounds, inner))
  if (holders.length === 0) return null
  return holders.reduce((smallest, holder) =>
    area(holder.bounds) < area(smallest.bounds) ? holder : smallest
  )
}

/** Wraps each set of layers that overlap one another in an inferred group. */
function groupOverlapping(siblings: Draft[]): Draft[] {
  return overlapClusters(siblings).map((members) => {
    if (members.length === 1) return members[0]
    return overlapGroup(members)
  })
}

/** The siblings split into sets that overlap, each set and the sets in drawing order. */
function overlapClusters(siblings: Draft[]): Draft[][] {
  const roots = siblings.map((_, index) => index)
  const find = (index: number): number => (roots[index] === index ? index : find(roots[index]))
  for (const [a, b] of overlappingPairs(siblings)) {
    const [first, second] = [find(a), find(b)]
    roots[Math.max(first, second)] = Math.min(first, second)
  }
  const byRoot = groupBy(siblings, (_, index) => find(index))
  return Object.values(byRoot)
}

/** The positions of each two siblings that overlap, the lower one first. */
function overlappingPairs(siblings: readonly Draft[]): [number, number][] {
  const pairs: [number, number][] = []
  siblings.forEach((draft, a) => {
    for (let b = a + 1; b < siblings.length; b++) {
      if (overlaps(draft.bounds, siblings[b].bounds)) pairs.push([a, b])
    }
  })
  return pairs
}

function overlapGroup(members: Draft[]): Draft {
  return {
    layer: {
      id: `inferred:${members[0].layer.id}`,
      name: 'Overlapping layers',
      kind: 'group',
      inferred: 'overlap'
    },
    bounds: unionOf(members.map((member) => member.bounds)),
    children: members
  }
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

/** Whether two boxes share some area; touching edges do not count. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function area(rect: Rect): number {
  return rect.width * rect.height
}

function unionOf(rects: readonly Rect[]): Rect {
  const x = minOf(rects.map((rect) => rect.x))
  const y = minOf(rects.map((rect) => rect.y))
  const right = maxOf(rects.map((rect) => rect.x + rect.width))
  const bottom = maxOf(rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}
