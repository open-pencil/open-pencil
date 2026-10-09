import { unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate'

import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { buildFigKiwi, parseFigKiwiChunks } from '@open-pencil/kiwi/fig/container'
import { decodeFigKiwiCanvas, parseFigKiwiContainer } from '@open-pencil/kiwi/fig/parse'
import type { HeaderFields } from '@open-pencil/kiwi/schema-runtime'

import { hasPNGSignature } from './thumbnail'

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

function isCanonicalCanvasEntry(name: string): boolean {
  return name === 'canvas.fig' || name === 'canvas'
}

function parseRawFigKiwi(
  bytes: Uint8Array,
  onPages?: (pages: FigPageManifestEntry[]) => void,
  headers?: HeaderFields
): FigParseResult | null {
  const chunks = parseFigKiwiChunks(bytes)
  if (!chunks) return null

  const decoded = decodeFigKiwiCanvas(bytes, onPages, headers)
  const thumbnailPNG = chunks.slice(2).find(hasPNGSignature) ?? null
  return { ...decoded, images: [], thumbnailPNG, metaJSON: null }
}

/**
 * Parse a complete zipped or legacy raw `.fig` file into its protocol payload and resources.
 * Records decoded as `headers` keep only the named fields; `decodeWhole` reads one in full.
 */
export function parseFigBuffer(
  buffer: ArrayBuffer,
  onPages?: (pages: FigPageManifestEntry[]) => void,
  headers?: HeaderFields
): FigParseResult {
  const bytes = new Uint8Array(buffer)
  const raw = parseRawFigKiwi(bytes, onPages, headers)
  if (raw) return raw

  const canvasArchive = unzipSync(bytes, { filter: ({ name }) => isCanonicalCanvasEntry(name) })
  let canvasData = findCanvasData(canvasArchive)
  let archive: Unzipped
  let decoded: ReturnType<typeof decodeFigKiwiCanvas>
  if (canvasData) {
    decoded = decodeFigKiwiCanvas(canvasData, onPages, headers)
    archive = unzipSync(bytes, { filter: ({ name }) => !isCanonicalCanvasEntry(name) })
  } else {
    archive = unzipSync(bytes)
    canvasData = findCanvasData(archive)
    if (!canvasData) {
      throw new Error(
        `No canvas data found in .fig file. Entries: ${Object.keys(archive).join(', ')}`
      )
    }
    decoded = decodeFigKiwiCanvas(canvasData, onPages, headers)
  }

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

/** A `.fig` file's parts with its Kiwi message still encoded, for copying records as bytes. */
export interface FigArchiveParts {
  schemaDeflated: Uint8Array
  /** The inflated Kiwi message. */
  dataRaw: Uint8Array
  figKiwiVersion: number
  images: Array<[string, Uint8Array]>
  thumbnailPNG: Uint8Array | null
  metaJSON: string | null
}

function canvasParts(canvasData: Uint8Array) {
  const payload = parseFigKiwiContainer(canvasData)
  if (!payload) throw new Error('Invalid fig-kiwi container')
  return {
    schemaDeflated: payload.schemaDeflated,
    dataRaw: payload.dataRaw,
    figKiwiVersion: payload.version
  }
}

export function readFigArchiveParts(buffer: ArrayBuffer): FigArchiveParts {
  const bytes = new Uint8Array(buffer)
  const chunks = parseFigKiwiChunks(bytes)
  if (chunks) {
    const thumbnailPNG = chunks.slice(2).find(hasPNGSignature) ?? null
    return { ...canvasParts(bytes), images: [], thumbnailPNG, metaJSON: null }
  }
  const canvasArchive = unzipSync(bytes, { filter: ({ name }) => isCanonicalCanvasEntry(name) })
  const canonical = findCanvasData(canvasArchive)
  const archive = unzipSync(
    bytes,
    canonical ? { filter: ({ name }) => !isCanonicalCanvasEntry(name) } : undefined
  )
  const canvasData = canonical ?? findCanvasData(archive)
  if (!canvasData)
    throw new Error(
      `No canvas data found in .fig file. Entries: ${Object.keys(archive).join(', ')}`
    )
  const images = Object.entries(archive)
    .filter(([name]) => name.startsWith('images/') && name !== 'images/')
    .map(([name, data]) => [name.slice('images/'.length), data] as [string, Uint8Array])
  return {
    ...canvasParts(canvasData),
    images,
    thumbnailPNG: archive['thumbnail.png'] ?? null,
    metaJSON: Object.hasOwn(archive, 'meta.json')
      ? new TextDecoder().decode(archive['meta.json'])
      : null
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
