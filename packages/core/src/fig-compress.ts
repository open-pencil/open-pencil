import { zipSync, type Zippable } from 'fflate'

import { buildFigKiwi } from './kiwi/kiwi-serialize'

export function compressFigDataSync(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>
): Uint8Array {
  const canvasData = buildFigKiwi(schemaDeflated, kiwiData)
  const zipEntries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [thumbnailPng, { level: 0 }],
    'meta.json': new TextEncoder().encode(metaJson)
  }
  for (const entry of imageEntries) {
    zipEntries[entry.name] = [entry.data, { level: 0 }]
  }
  return zipSync(zipEntries)
}
