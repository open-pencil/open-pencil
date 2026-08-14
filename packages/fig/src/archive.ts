import { unzipSync, zipSync, type Zippable } from 'fflate'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { buildFigKiwi } from '@open-pencil/kiwi/fig/container'
import { decodeFigKiwiCanvas } from '@open-pencil/kiwi/fig/parse'

export interface FigImageEntry {
  name: string
  data: Uint8Array
}

export interface WriteFigArchiveInput {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images?: FigImageEntry[]
  figKiwiVersion?: number
}

export interface FigParseResult {
  nodeChanges: NodeChange[]
  blobs: Uint8Array[]
  images: Array<[string, Uint8Array]>
  figKiwiVersion: number
  /** Deflated Kiwi schema bytes from the original file, retained for round-trip fidelity. */
  figSchemaDeflated: Uint8Array
  thumbnailPNG: Uint8Array | null
  metaJSON: string | null
}

function isLikelyAsset(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.json')
}

function findCanvasData(entries: Partial<Record<string, Uint8Array>>): Uint8Array | null {
  const canonical = entries['canvas.fig'] ?? entries.canvas
  if (canonical) return canonical

  let largest: Uint8Array | null = null
  for (const [name, data] of Object.entries(entries)) {
    if (!data || isLikelyAsset(name)) continue
    if (!largest || data.byteLength > largest.byteLength) largest = data
  }
  return largest
}

/** Parse a complete zipped `.fig` file into its Figma protocol payload and binary resources. */
export function parseFigBuffer(buffer: ArrayBuffer): FigParseResult {
  const archive = unzipSync(new Uint8Array(buffer))
  const canvasData = findCanvasData(archive)
  if (!canvasData) {
    throw new Error(
      `No canvas data found in .fig file. Entries: ${Object.keys(archive).join(', ')}`
    )
  }

  const decoded = decodeFigKiwiCanvas(canvasData)
  const metaBytes = archive['meta.json']
  const images = Object.entries(archive)
    .filter(([name]) => name.startsWith('images/') && name !== 'images/')
    .map(([name, data]) => [name.slice('images/'.length), data] as [string, Uint8Array])

  return {
    ...decoded,
    images,
    thumbnailPNG: archive['thumbnail.png'] ?? null,
    metaJSON: Object.hasOwn(archive, 'meta.json') ? new TextDecoder().decode(metaBytes) : null
  }
}

/** Assemble a complete zipped `.fig` archive from an encoded Kiwi message and resources. */
export function writeFigArchive(input: WriteFigArchiveInput): Uint8Array {
  const canvasData = buildFigKiwi(input.schemaDeflated, input.kiwiData, input.figKiwiVersion)
  const entries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [input.thumbnailPNG, { level: 0 }],
    'meta.json': new TextEncoder().encode(input.metaJSON)
  }
  for (const image of input.images ?? []) entries[image.name] = [image.data, { level: 0 }]
  return zipSync(entries)
}

/** Compatibility signature used by core while archive assembly migrates to this package. */
export function compressFigDataSync(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPNG: Uint8Array,
  metaJSON: string,
  imageEntries: FigImageEntry[],
  figKiwiVersion?: number
): Uint8Array {
  return writeFigArchive({
    schemaDeflated,
    kiwiData,
    thumbnailPNG,
    metaJSON,
    images: imageEntries,
    figKiwiVersion
  })
}
