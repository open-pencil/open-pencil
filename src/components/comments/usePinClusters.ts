import { meanBy, partition } from 'es-toolkit'
import { computed, type ComputedRef } from 'vue'

import { groupMarks } from '@open-pencil/core/canvas'
import { ZOOM_MAX } from '@open-pencil/core/constants'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { COMMENT_CLUSTER_GAP, COMMENT_PIN_SIZE } from '@/theme/comments'

/** A pin as the comments layer places it: `left`/`top` is its tip in the pins' layer. */
interface PlacedPin {
  thread: { id: string }
  at: Vector
  left: number
  top: number
  /** Kept out of clusters: a pin pressed or dragged, or whose thread is open, stays itself. */
  standalone: boolean
}

/** Pins drawn as one count bubble, centered among their bubbles in the pins' layer. */
export interface PinCluster<P> {
  /** The pins' thread ids, space-separated, so `[data-cluster~="id"]` finds a pin's cluster. */
  key: string
  pins: P[]
  left: number
  top: number
}

interface PinGroup<P> {
  items: P[]
  rect: Rect
}

/** How much closer than the gap the nearest pins land after a cluster is clicked. */
const CLUSTER_ZOOM_MARGIN = 1.25

/** Where a pin's bubble centers, which is what clusters are measured between. */
function bubbleCenter(pin: PlacedPin) {
  const half = COMMENT_PIN_SIZE / 2
  return { x: pin.left + half, y: pin.top - half }
}

function centerOf(pins: readonly PlacedPin[]): Rect {
  return {
    x: meanBy(pins, (pin) => bubbleCenter(pin).x),
    y: meanBy(pins, (pin) => bubbleCenter(pin).y),
    width: 0,
    height: 0
  }
}

/** The box around pins' bubble centers, which a pin within the gap of joins their cluster. */
function spanOf(pins: readonly PlacedPin[]): Rect {
  return computeBounds(pins.map((pin) => ({ ...bubbleCenter(pin), width: 0, height: 0 })))
}

/**
 * Gathers pins that crowd each other on the screen into count bubbles, as Figma does when
 * zoomed out: a pin within `COMMENT_CLUSTER_GAP` of a cluster's members joins it, and the
 * bubble centers among them.
 */
function groupPins<P extends PlacedPin>(pins: readonly P[]): PinGroup<P>[] {
  let groups: PinGroup<P>[] = groupMarks(
    pins.map((pin) => ({ item: pin, rect: spanOf([pin]) })),
    COMMENT_CLUSTER_GAP,
    spanOf
  ).map(({ items }) => ({ items, rect: centerOf(items) }))
  // Bubbles center among their members, so two can land on each other; merge until none do.
  for (;;) {
    const merged = groupMarks(
      groups.map((group) => ({ item: group, rect: group.rect })),
      COMMENT_CLUSTER_GAP,
      (joined) => centerOf(joined.flatMap((group) => group.items))
    )
    if (merged.length === groups.length) return groups
    groups = merged.map(({ items, rect }) => ({
      items: items.flatMap((group) => group.items),
      rect
    }))
  }
}

export function usePinClusters<P extends PlacedPin>(pins: ComputedRef<P[]>) {
  const placement = computed(() => {
    const [standalone, crowdable] = partition(pins.value, (pin) => pin.standalone)
    const [single, crowded] = partition(groupPins(crowdable), (group) => group.items.length === 1)
    return {
      pins: [...standalone, ...single.flatMap((group) => group.items)],
      clusters: crowded.map(({ items, rect }): PinCluster<P> => ({
        key: items.map((pin) => pin.thread.id).join(' '),
        pins: items,
        left: rect.x,
        top: rect.y
      }))
    }
  })

  return {
    pins: computed(() => placement.value.pins),
    clusters: computed(() => placement.value.clusters)
  }
}

/**
 * Where a click on a cluster takes the view, as in Figma: its pins fitted in view, zoomed in no
 * further than it takes the nearest two to clear each other.
 */
export function clusterView(cluster: PinCluster<PlacedPin>): { bounds: Rect; maxZoom: number } {
  const points = cluster.pins.map((pin) => pin.at)
  let nearest = Infinity
  for (const [index, a] of points.entries()) {
    for (const b of points.slice(index + 1)) {
      nearest = Math.min(nearest, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)))
    }
  }
  return {
    bounds: computeBounds(points.map((point) => ({ ...point, width: 0, height: 0 }))),
    // Pins at one spot never part; the view zooms in as far as it goes.
    maxZoom: nearest > 0 ? (COMMENT_CLUSTER_GAP * CLUSTER_ZOOM_MARGIN) / nearest : ZOOM_MAX
  }
}
