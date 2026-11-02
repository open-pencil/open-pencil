import { unzipSync, zipSync, type Unzipped, type Zippable } from 'fflate'
import * as v from 'valibot'

import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  buildFigKiwi,
  figFileKind,
  parseFigKiwiChunks,
  type FigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'
import { decodeFigKiwiCanvas, parseFigKiwiContainer } from '@open-pencil/kiwi/fig/parse'
import type { HeaderFields } from '@open-pencil/kiwi/schema-runtime'
import type { Color, Rect, Size } from '@open-pencil/scene-graph/primitives'

import { figArchiveMetaSchema, type FigArchiveMetaJSON } from './schema'
import { isPNG } from './thumbnail'

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
  /** Compresses the document data; Bun's zstd or deflate when omitted. */
  compress?: FigDataCompressor
  /** A design file, or a FigJam board saved as `.jam`; a design when omitted. */
  kind?: FigFileKind
}

export interface FigParseResult {
  nodeChanges: NodeChange[]
  blobs: Uint8Array[]
  images: Array<[string, Uint8Array]>
  figKiwiVersion: number
  /** Deflated Kiwi schema bytes from the original file, retained for round-trip fidelity. */
  figSchemaDeflated: Uint8Array
  /** A design file or a FigJam board, by the canvas's header. */
  kind: FigFileKind
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

/**
 * Whether a `.fig` or `.jam` archive, or a bare canvas, holds a design or a FigJam board, by its
 * canvas's header, without decoding the document; `null` when it holds no Figma canvas.
 */
export function figArchiveKind(bytes: Uint8Array): FigFileKind | null {
  const bare = figFileKind(bytes)
  if (bare) return bare
  try {
    const entries: Partial<Record<string, Uint8Array>> = unzipSync(bytes, {
      filter: ({ name }) => isCanonicalCanvasEntry(name)
    })
    const canvas = entries['canvas.fig'] ?? entries.canvas
    return canvas ? figFileKind(canvas) : null
  } catch {
    return null
  }
}

function parseRawFigKiwi(
  bytes: Uint8Array,
  onPages?: (pages: FigPageManifestEntry[]) => void,
  headers?: HeaderFields
): FigParseResult | null {
  const chunks = parseFigKiwiChunks(bytes)
  if (!chunks) return null

  const decoded = decodeFigKiwiCanvas(bytes, onPages, headers)
  const thumbnailPNG = chunks.slice(2).find(isPNG) ?? null
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
  /** A design file or a FigJam board, by the canvas's header. */
  kind: FigFileKind
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
    figKiwiVersion: payload.version,
    kind: payload.kind
  }
}

export function readFigArchiveParts(buffer: ArrayBuffer): FigArchiveParts {
  const bytes = new Uint8Array(buffer)
  const chunks = parseFigKiwiChunks(bytes)
  if (chunks) {
    const thumbnailPNG = chunks.slice(2).find(isPNG) ?? null
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

/** What an archive's `meta.json` records about the file and its `thumbnail.png`. */
export interface FigArchiveMeta {
  fileName: string
  /** The background of the page the thumbnail shows. */
  backgroundColor: Color
  /** The thumbnail's size in pixels. */
  thumbnailSize: Size
  /** The page-space rectangle the thumbnail shows. */
  renderCoordinates: Rect
  exportedAt: Date
}

/**
 * The `meta.json` Figma's "Save local copy…" writes, in its key order. Colour channels are
 * rounded to the 32-bit floats the canvas records store, so they read as Figma's do.
 */
export function figArchiveMetaJSON(meta: FigArchiveMeta): string {
  const { r, g, b, a } = meta.backgroundColor
  const { x, y, width, height } = meta.renderCoordinates
  const json: FigArchiveMetaJSON = {
    client_meta: {
      background_color: {
        r: Math.fround(r),
        g: Math.fround(g),
        b: Math.fround(b),
        a: Math.fround(a)
      },
      thumbnail_size: { width: meta.thumbnailSize.width, height: meta.thumbnailSize.height },
      render_coordinates: { x, y, width, height }
    },
    file_name: meta.fileName,
    developer_related_links: [],
    exported_at: meta.exportedAt.toISOString()
  }
  return JSON.stringify(json)
}

/** Decode an archive's `meta.json`, failing on malformed JSON and on a shape Figma does not write. */
export function readFigArchiveMeta(text: string) {
  return v.safeParse(v.pipe(v.string(), v.parseJson(), figArchiveMetaSchema), text)
}

/** Any `meta.json` object, its keys in the order they were written. */
const storedMetaSchema = v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.unknown()))

/**
 * The archive with its `meta.json` recording `fileName`, every other entry's bytes and every
 * other key of `meta.json` as they were; the archive itself when it already records that name.
 * Null when its `meta.json` records no `file_name`, which only a full write can give it.
 */
export function renameFigArchive(bytes: Uint8Array, fileName: string): Uint8Array | null {
  if (parseFigKiwiChunks(bytes)) return null
  const stored = unzipSync(bytes, { filter: ({ name }) => name === 'meta.json' })
  if (!Object.hasOwn(stored, 'meta.json')) return null
  const meta = v.safeParse(storedMetaSchema, new TextDecoder().decode(stored['meta.json']))
  if (!meta.success || typeof meta.output.file_name !== 'string') return null
  if (meta.output.file_name === fileName) return bytes
  const renamed: Zippable = {}
  for (const [name, data] of Object.entries(unzipSync(bytes))) {
    renamed[name] =
      name === 'meta.json'
        ? new TextEncoder().encode(JSON.stringify({ ...meta.output, file_name: fileName }))
        : [data, { level: 0 }]
  }
  return zipSync(renamed)
}

/** Assemble a complete zipped `.fig` archive from an encoded Kiwi message and resources. */
export function writeFigArchive(input: WriteFigArchiveInput): Uint8Array {
  const canvasData = buildFigKiwi(
    input.schemaDeflated,
    input.kiwiData,
    input.figKiwiVersion,
    input.compress,
    input.kind
  )
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
  figKiwiVersion?: number,
  compress?: FigDataCompressor,
  kind?: FigFileKind
): Uint8Array {
  return writeFigArchive({
    schemaDeflated,
    kiwiData,
    thumbnailPNG,
    metaJSON,
    images: imageEntries,
    figKiwiVersion,
    compress,
    kind
  })
}
