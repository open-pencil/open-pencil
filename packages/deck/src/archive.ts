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

/** Gap Figma leaves around the slide row; mirrors SLIDE_PADDING in structure.ts. */
const DECK_SLIDE_PADDING = 240
/** Zoomed-out slides backdrop Figma paints behind the grid. */
const DECK_BACKDROP = { r: 0.1176, g: 0.1176, b: 0.1176, a: 1 }

export type DeckMetaInput = {
  /** How many slides the presentation holds — the row is this many slides wide. */
  slideCount?: number
  slideWidth?: number
  slideHeight?: number
}

/**
 * Figma reads `render_coordinates` as the extent of the whole presentation, not of one
 * slide: a 33-slide deck spans 33 x (slide width + padding). Declaring a single slide made
 * the file open with nothing rendered.
 */
export function defaultDeckMetaJson(fileName = 'Untitled.deck', input: DeckMetaInput = {}): string {
  const slideCount = Math.max(1, input.slideCount ?? 1)
  const slideWidth = input.slideWidth ?? 1920
  const slideHeight = input.slideHeight ?? 1080
  const width = slideCount * (slideWidth + DECK_SLIDE_PADDING)
  const height = slideHeight + DECK_SLIDE_PADDING * 2
  return JSON.stringify({
    client_meta: {
      background_color: { ...DECK_BACKDROP },
      thumbnail_size: { width: 400, height: Math.max(1, Math.round((400 * height) / width)) },
      render_coordinates: { x: 0, y: 0, width, height }
    },
    file_name: fileName.replace(/\.deck$/i, ''),
    developer_related_links: [],
    exported_at: new Date().toISOString()
  })
}
