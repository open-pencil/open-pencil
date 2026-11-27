import type { FunctionalComponent } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'

import { maskIcon } from '@/components/icons/mask'

import { easingLine, GRAPH_SIZE, type EasingPlacement } from './graph'

/**
 * The dotted square an easing's thumbnail is drawn in, as Figma's list and menus draw it: a curve
 * fills it from corner to corner, and a spring runs from its bottom to its top over its settling
 * time. What goes past 0 or 1, a back curve or a spring's bounce, has the margin around it.
 */
const FRAME = { start: 18, size: 64 }

const inFrame = (x: number, y: number) => ({
  x: FRAME.start + x * FRAME.size,
  y: FRAME.start + (1 - y) * FRAME.size
})
const THUMBNAIL_PLACEMENT: EasingPlacement = { curve: inFrame, spring: inFrame }

/** An easing's line in its dotted square, in the text color. */
export function easingThumbnailSVG(easing: Easing): string {
  const line = easingLine(easing, THUMBNAIL_PLACEMENT)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}">`,
    `<rect x="${FRAME.start}" y="${FRAME.start}" width="${FRAME.size}" height="${FRAME.size}" fill="none" stroke="black" stroke-opacity="0.4" stroke-width="5" stroke-dasharray="1 8" stroke-linecap="round"/>`,
    `<path d="${line}" fill="none" stroke="black" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</svg>'
  ].join('')
}

/** The most drawings kept: a list's easings and some to spare, not every step of every edit. */
const KEPT_THUMBNAILS = 256

/** Recent drawings' icons, so an easing draws the same however often it is listed. */
const thumbnails = new Map<string, FunctionalComponent>()

/** An easing's thumbnail as an icon component; the caller's class sizes it. */
export function easingThumbnail(easing: Easing): FunctionalComponent {
  const svg = easingThumbnailSVG(easing)
  const icon = thumbnails.get(svg) ?? maskIcon(svg)
  // Most recently used last, so the first is the one to let go.
  thumbnails.delete(svg)
  thumbnails.set(svg, icon)
  const oldest = thumbnails.keys().next()
  if (thumbnails.size > KEPT_THUMBNAILS && !oldest.done) thumbnails.delete(oldest.value)
  return icon
}
