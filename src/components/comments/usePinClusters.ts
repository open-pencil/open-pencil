import { meanBy, partition } from 'es-toolkit'
import { computed, type ComputedRef } from 'vue'

import { groupMarks } from '@open-pencil/core/canvas'
import { ZOOM_MAX } from '@open-pencil/core/constants'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { COMMENT_CLUSTER_GAP, COMMENT_PIN_SIZE } from '@/theme/comments'

/** A pin as the comments layer places it: `left`/`top` is its tip in the pins' layer. */
interface PlacedPin {
  thread: { id: string }
  at: Vector
  left: number
  top: number
  /** Kept out of clusters: a pin being dragged or whose thread is open stays where it is. */
  standalone: boolean
}

/** Pins drawn as one count bubble, centered among their bubbles in the pins' layer. */
export interface PinCluster<P> {
  key: string
  pins: P[]
  left: number
  top: number
}

/** How much closer than the gap the nearest pins land after a cluster is clicked. */
const CLUSTER_ZOOM_MARGIN = 1.25

/** Where a pin's bubble centers, which is what clusters are measured between. */
function bubbleCenter(pin: PlacedPin) {
  const half = COMMENT_PIN_SIZE / 2
  return { x: pin.left + half, y: pin.top - half, width: 0, height: 0 }
}

/**
 * Gathers pins that crowd each other on the screen into count bubbles, as Figma does when
 * zoomed out: pins whose bubbles come within `COMMENT_CLUSTER_GAP` join, and a cluster centers
 * on its members, so a pin near the middle of a crowd joins it too.
 */
export function usePinClusters<P extends PlacedPin>(pins: ComputedRef<P[]>) {
  const placement = computed(() => {
    const [standalone, crowdable] = partition(pins.value, (pin) => pin.standalone)
    const groups = groupMarks(
      crowdable.map((pin) => ({ item: pin, rect: bubbleCenter(pin) })),
      COMMENT_CLUSTER_GAP,
      (members) => ({
        x: meanBy(members, (pin) => bubbleCenter(pin).x),
        y: meanBy(members, (pin) => bubbleCenter(pin).y),
        width: 0,
        height: 0
      })
    )
    const [single, crowded] = partition(groups, (group) => group.items.length === 1)
    return {
      pins: [...standalone, ...single.map((group) => group.items[0])],
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
 * Where a click on a cluster takes the view, as in Figma: centered on its pins, zoomed in until
 * the nearest two are clear of each other, and always at least twice as close.
 */
export function clusterZoomTarget(
  cluster: PinCluster<PlacedPin>,
  zoom: number
): { x: number; y: number; zoom: number } {
  const points = cluster.pins.map((pin) => pin.at)
  let nearest = Infinity
  for (const [index, a] of points.entries()) {
    for (const b of points.slice(index + 1)) {
      nearest = Math.min(nearest, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)))
    }
  }
  // Pins at one spot never part; the view zooms in as far as it goes.
  const apart = nearest > 0 ? (COMMENT_CLUSTER_GAP * CLUSTER_ZOOM_MARGIN) / nearest : ZOOM_MAX
  return {
    x: meanBy(points, (point) => point.x),
    y: meanBy(points, (point) => point.y),
    zoom: Math.max(apart, zoom * 2)
  }
}
