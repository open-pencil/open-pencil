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
  // The colour mark keeps its colours on dark backgrounds.
  if (mode === 'dark') return source
  // One colour: the single silhouette, since abutting pieces of one colour would show seams.
  const svg = stringToSVG(source, adapter)
  for (const path of svg.find('[data-part]')) path.remove()
  for (const path of svg.find('[data-shape="silhouette"]')) {
    path.fill(mode === 'mono' ? brand.ink : brand.paper)
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
  const scale = {
    web: brand.appScale,
    maskable: brand.maskableScale,
    tile: brand.tileScale,
    desktop: brand.desktopScale
  }[kind]
  const mark = stringToSVG(source, adapter).size(1024 * scale, 1024 * scale)
  mark.move((1024 * (1 - scale)) / 2, (1024 * (1 - scale)) / 2)
  svg.add(mark)
  return svg.svg()
}
