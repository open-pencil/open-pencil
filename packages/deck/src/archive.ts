import { zipSync, type Zippable } from 'fflate'

import { buildFigKiwi } from '@open-pencil/kiwi/fig/container'

import { FIG_DECK_PRELUDE, setCanvasPrelude } from './prelude'

export interface WriteDeckArchiveInput {
  schemaDeflated: Uint8Array
  /** Raw (uncompressed) Kiwi message bytes. */
  kiwiData: Uint8Array
  thumbnailPng: Uint8Array
  metaJson: string
  images?: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
}

/** Assemble a complete zipped `.deck` archive with `fig-deck` prelude. */
export function writeDeckArchive(input: WriteDeckArchiveInput): Uint8Array {
  if (!input.thumbnailPng?.byteLength) {
    throw new Error('Deck write requires thumbnail.png bytes')
  }

  const canvasKiwi = buildFigKiwi(input.schemaDeflated, input.kiwiData, input.figKiwiVersion)
  const canvasData = setCanvasPrelude(canvasKiwi, FIG_DECK_PRELUDE)

  const entries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [input.thumbnailPng, { level: 0 }],
    'meta.json': new TextEncoder().encode(input.metaJson)
  }

  for (const image of input.images ?? []) {
    const name = image.name.startsWith('images/') ? image.name : `images/${image.name}`
    entries[name] = [image.data, { level: 0 }]
  }

  return zipSync(entries)
}

export function defaultDeckMetaJson(fileName = 'Untitled.deck'): string {
  return JSON.stringify({
    client_meta: {
      background_color: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
      thumbnail_size: { width: 400, height: 260 },
      render_coordinates: { x: 0, y: 0, width: 1920, height: 1080 }
    },
    file_name: fileName.replace(/\.deck$/i, ''),
    developer_related_links: []
  })
}
