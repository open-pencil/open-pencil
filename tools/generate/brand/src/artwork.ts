import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { stringToSvg as stringToSVG } from '@realfavicongenerator/generate-favicon'
import type { ImageAdapter } from '@realfavicongenerator/generate-favicon'
import { getNodeImageAdapter } from '@realfavicongenerator/image-adapter-node'

import { brand } from './config.ts'

export async function loadArtwork(root: string) {
  const adapter = await getNodeImageAdapter()
  const main = await readFile(join(root, 'assets/brand/mark.svg'), 'utf8')
  const micro = await readFile(join(root, 'assets/brand/mark-micro.svg'), 'utf8')
  return { adapter, main, micro }
}

export function recolor(
  source: string,
  adapter: ImageAdapter,
  mode: 'dark' | 'mono' | 'mono-dark'
) {
  const svg = stringToSVG(source, adapter)
  if (mode === 'dark') {
    for (const [part, color] of Object.entries(brand.darkPalette)) {
      for (const path of svg.find(`[data-part="${part}"]`)) path.fill(color)
    }
    for (const grid of svg.find('[data-detail="grid"]')) grid.opacity(brand.darkGridOpacity)
  } else {
    for (const detail of svg.find('[data-detail]')) detail.remove()
    for (const path of svg.find('[data-part]')) {
      path.fill(mode === 'mono' ? brand.darkBackground : brand.background)
    }
  }
  return svg.svg()
}

/** Shared rounded app icon; touch and maskable variants leave cropping to the platform. */
export function appArtwork(
  source: string,
  adapter: ImageAdapter,
  kind: 'web' | 'maskable' | 'tile' | 'desktop'
) {
  const svg = adapter.createSvg().size(1024, 1024).viewbox(0, 0, 1024, 1024)
  const rounded = kind === 'tile' || kind === 'desktop'
  const inset = kind === 'desktop' ? brand.tileInset : 0
  const background = svg
    .rect(1024 - inset * 2, 1024 - inset * 2)
    .move(inset, inset)
    .fill(brand.background)
  if (rounded) background.radius(brand.tileRadius)
  const regularScale = kind === 'tile' ? brand.tileScale : brand.appScale
  const scale = kind === 'maskable' ? brand.maskableScale : regularScale
  const mark = stringToSVG(source, adapter).size(1024 * scale, 1024 * scale)
  mark.move((1024 * (1 - scale)) / 2, (1024 * (1 - scale)) / 2)
  svg.add(mark)
  return svg.svg()
}

const BIMI_SIZE = 256

/**
 * The mark for BIMI, the logo mail apps show beside the domain's messages: SVG Tiny Portable/Secure,
 * which has no patterns, clipping, references, or arcs, on the ivory tile, and sized to stay
 * inside the circle most apps crop it to. The grid is left out, as in the monochrome mark, and an
 * arc becomes the circle it draws.
 */
export function bimiArtwork(source: string, adapter: ImageAdapter): string {
  const mark = stringToSVG(source, adapter)
  const [x = 0, y = 0, width = 0, height = 0] = String(mark.attr('viewBox'))
    .split(/\s+/)
    .map(Number)
  const center = { x: x + width / 2, y: y + height / 2 }
  const parts = mark.find('[data-part]')
  // The farthest any part reaches from the mark's center, which the crop circle must still hold.
  let reach = 0
  for (const part of parts) {
    const box = part.bbox()
    for (const px of [box.x, box.x2]) {
      for (const py of [box.y, box.y2]) {
        reach = Math.max(reach, Math.hypot(px - center.x, py - center.y))
      }
    }
  }
  const scale = ((BIMI_SIZE / 2) * brand.bimiReach) / reach
  const shapes = parts.map((part) => {
    const fill = String(part.attr('fill'))
    const d = String(part.attr('d'))
    if (/[Aa]/.test(d)) {
      const box = part.bbox()
      return `<circle cx="${box.cx}" cy="${box.cy}" r="${box.width / 2}" fill="${fill}"/>`
    }
    const rule = part.attr('fill-rule') ? ` fill-rule="${String(part.attr('fill-rule'))}"` : ''
    return `<path d="${d}" fill="${fill}"${rule}/>`
  })
  const half = BIMI_SIZE / 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 ${BIMI_SIZE} ${BIMI_SIZE}">`,
    '<title>OpenPencil</title>',
    `<rect width="${BIMI_SIZE}" height="${BIMI_SIZE}" fill="${brand.background}"/>`,
    `<g transform="translate(${half} ${half}) scale(${scale.toFixed(4)}) translate(${-center.x} ${-center.y})">`,
    ...shapes,
    '</g>',
    '</svg>',
    ''
  ].join('\n')
}
