import { buildFigKiwi } from '#core/kiwi/node-change/serialize'
import { zipSync, type Zippable } from 'fflate'

export function compressFigDataSync(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPng: Uint8Array,
  metaJson: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number
): Uint8Array {
  const canvasData = buildFigKiwi(schemaDeflated, kiwiData, figKiwiVersion)
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
