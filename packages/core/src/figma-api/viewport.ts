import * as v from 'valibot'

import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { ZOOM_MAX, ZOOM_MIN } from '#core/constants'
import { atLeast, finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

/** A host's view of the canvas, which `figma.viewport` reads and moves. */
export interface FigmaViewportHost {
  /** The world point at the middle of the view, the zoom, and the world rectangle on screen. */
  get(): { center: Vector; zoom: number; bounds: Rect }
  /** Centres the view on `center` at `zoom` on the page `pageId`. */
  set(pageId: string, center: Vector, zoom: number): void
  /**
   * Scrolls and zooms the page `pageId` so the world rectangle fills the view, zooming in no
   * further than 100%, as Figma's `scrollAndZoomIntoView` does.
   */
  fit(pageId: string, bounds: Rect): void
}

/** Figma's `figma.viewport`. */
export interface FigmaViewport {
  center: Vector
  zoom: number
  readonly bounds: Rect
  scrollAndZoomIntoView(nodes: readonly { absoluteBoundingBox: Rect }[]): void
}

const centerSchema = v.object({ x: finiteNumberSchema, y: finiteNumberSchema })
const zoomSchema = atLeast(0)

/**
 * The view of an API no host shows: a center and zoom it keeps, with no screen around them, so
 * fitting layers centres them and leaves the zoom alone.
 */
export function detachedViewport(): FigmaViewportHost {
  let center: Vector = { x: 0, y: 0 }
  let zoom = 1
  return {
    get: () => ({ center, zoom, bounds: { ...center, width: 0, height: 0 } }),
    set: (_pageId, nextCenter, nextZoom) => {
      center = nextCenter
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom))
    },
    fit: (_pageId, bounds) => {
      center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    }
  }
}

/**
 * `figma.viewport` over `host` for the page `currentPageId` names. As in Figma, layers on
 * another page fit by their coordinates on the current one.
 */
export class Viewport implements FigmaViewport {
  readonly #host: FigmaViewportHost
  readonly #currentPageId: () => string

  constructor(host: FigmaViewportHost, currentPageId: () => string) {
    this.#host = host
    this.#currentPageId = currentPageId
  }

  get center(): Vector {
    return { ...this.#host.get().center }
  }

  set center(value: Vector) {
    const { x, y } = parseFigma(centerSchema, value, 'set_center', 'viewport.center')
    this.#host.set(this.#currentPageId(), { x, y }, this.#host.get().zoom)
  }

  get zoom(): number {
    return this.#host.get().zoom
  }

  set zoom(value: number) {
    const zoom = parseFigma(zoomSchema, value, 'set_zoom', 'viewport.zoom')
    this.#host.set(this.#currentPageId(), this.#host.get().center, zoom)
  }

  get bounds(): Rect {
    return { ...this.#host.get().bounds }
  }

  scrollAndZoomIntoView(nodes: readonly { absoluteBoundingBox: Rect }[]): void {
    if (nodes.length === 0) return
    const bounds = computeBounds(nodes.map((node) => node.absoluteBoundingBox))
    this.#host.fit(this.#currentPageId(), bounds)
  }
}
