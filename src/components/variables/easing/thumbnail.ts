import type { FunctionalComponent } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'

import { maskIcon } from '@/components/icons/mask'

import { easingDrawing, GRAPH_SIZE } from './graph'

/** The dotted square Figma draws behind an easing's thumbnail, as a fraction of the box. */
const FRAME = { start: 14, size: 72 }

/** An easing's line in a dotted square, as Figma's list and menus show it, in the text color. */
export function easingThumbnailSVG(easing: Easing): string {
  const { line } = easingDrawing(easing)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRAPH_SIZE} ${GRAPH_SIZE}">`,
    `<rect x="${FRAME.start}" y="${FRAME.start}" width="${FRAME.size}" height="${FRAME.size}" fill="none" stroke="black" stroke-opacity="0.45" stroke-width="5" stroke-dasharray="2 10"/>`,
    `<path d="${line}" fill="none" stroke="black" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</svg>'
  ].join('')
}

/** Each drawing's icon, built once: an easing draws the same however often it is listed. */
const thumbnails = new Map<string, FunctionalComponent>()

/** An easing's thumbnail as an icon component; the caller's class sizes it. */
export function easingThumbnail(easing: Easing): FunctionalComponent {
  const svg = easingThumbnailSVG(easing)
  let icon = thumbnails.get(svg)
  if (!icon) {
    icon = maskIcon(svg)
    thumbnails.set(svg, icon)
  }
  return icon
}
