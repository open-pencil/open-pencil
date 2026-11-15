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

import { figArchiveMetaSchema, type FigArchiveMetaJSON } from '../schema'
import { isPNG } from '../thumbnail'
import { readZipDirectory, zipEntryContents } from '../zip/directory'
import { bytesStream, zipStream, type ZipStreamEntry } from '../zip/stream'

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

/**
 * Which entry holds the document: `canvas.fig`, or `canvas` in older files, or else the largest
 * entry that is not an image or JSON.
 */
function canvasEntryName(
  entries: ReadonlyArray<readonly [name: string, size: number]>
): string | null {
  for (const canonical of ['canvas.fig', 'canvas']) {
    if (entries.some(([name]) => name === canonical)) return canonical
  }
  let largest: { name: string; size: number } | null = null
  for (const [name, size] of entries) {
    if (isLikelyAsset(name) || (largest && largest.size >= size)) continue
    largest = { name, size }
  }
  return largest?.name ?? null
}

function findCanvasData(entries: Partial<Record<string, Uint8Array>>): Uint8Array | null {
  const name = canvasEntryName(
    Object.entries(entries).flatMap(([entry, data]) =>
      data ? [[entry, data.byteLength] as const] : []
    )
  )
  return name === null ? null : (entries[name] ?? null)
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
  return {
    ...decoded,
    images: archiveFolder(archive, 'images/'),
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
  /** Video clips, kept so a patched archive still holds the clips its video paints name. */
  videos: Array<[string, Uint8Array]>
  thumbnailPNG: Uint8Array | null
  metaJSON: string | null
}

function archiveFolder(
  archive: Unzipped,
  folder: 'images/' | 'videos/'
): Array<[string, Uint8Array]> {
  return Object.entries(archive)
    .filter(([name]) => name.startsWith(folder) && name !== folder)
    .map(([name, data]) => [name.slice(folder.length), data])
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

/**
 * A `.fig` file's parts, read through its ZIP directory: stored entries, as images are, stay views
 * of `buffer` rather than copies, so patching a large archive does not hold its images twice.
 */
export function readFigArchiveParts(buffer: ArrayBuffer): FigArchiveParts {
  const bytes = new Uint8Array(buffer)
  const chunks = parseFigKiwiChunks(bytes)
  if (chunks) {
    const thumbnailPNG = chunks.slice(2).find(isPNG) ?? null
    return { ...canvasParts(bytes), images: [], videos: [], thumbnailPNG, metaJSON: null }
  }
  const entries = readZipDirectory(bytes)
  if (!entries) throw new Error('Not a .fig file: neither a ZIP archive nor a fig-kiwi container')
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const contents = (name: string | null) => {
    const entry = name === null ? undefined : byName.get(name)
    return entry ? zipEntryContents(bytes, entry) : null
  }
  const canvasData = contents(canvasEntryName(entries.map((entry) => [entry.name, entry.size])))
  if (!canvasData) {
    throw new Error(
      `No canvas data found in .fig file. Entries: ${entries.map((entry) => entry.name).join(', ')}`
    )
  }
  const folder = (prefix: 'images/' | 'videos/'): Array<[string, Uint8Array]> =>
    entries
      .filter((entry) => entry.name.startsWith(prefix) && entry.name !== prefix)
      .map((entry) => [entry.name.slice(prefix.length), zipEntryContents(bytes, entry)])
  const meta = contents('meta.json')
  return {
    ...canvasParts(canvasData),
    images: folder('images/'),
    videos: folder('videos/'),
    thumbnailPNG: contents('thumbnail.png'),
    metaJSON: meta ? new TextDecoder().decode(meta) : null
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
 * other key of `meta.json` as they were, or the archive itself when it already records that name;
 * entries the archive stores pass through as views of `bytes`. Null when its `meta.json` records
 * no `file_name`, which only a full write can give it.
 */
export function renameFigArchive(
  bytes: Uint8Array,
  fileName: string
): ReadableStream<Uint8Array> | null {
  const entries = readZipDirectory(bytes)
  const metaEntry = entries?.find((entry) => entry.name === 'meta.json')
  if (!entries || !metaEntry) return null
  const meta = v.safeParse(
    storedMetaSchema,
    new TextDecoder().decode(zipEntryContents(bytes, metaEntry))
  )
  if (!meta.success || typeof meta.output.file_name !== 'string') return null
  if (meta.output.file_name === fileName) return bytesStream(bytes)
  const renamed = new TextEncoder().encode(JSON.stringify({ ...meta.output, file_name: fileName }))
  return zipStream(
    entries.map((entry) =>
      entry === metaEntry
        ? { name: entry.name, data: renamed, deflate: true }
        : { name: entry.name, data: zipEntryContents(bytes, entry), deflate: entry.method !== 0 }
    )
  )
}

/** A complete `.fig` archive's parts, its document data already in its `fig-kiwi` container. */
export interface FigArchiveContents {
  canvasFig: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images?: readonly FigImageEntry[]
}

/** The entries of a `.fig` archive, in the order Figma writes them. */
function figArchiveEntries(contents: FigArchiveContents): ZipStreamEntry[] {
  return [
    { name: 'canvas.fig', data: contents.canvasFig },
    { name: 'thumbnail.png', data: contents.thumbnailPNG },
    { name: 'meta.json', data: new TextEncoder().encode(contents.metaJSON), deflate: true },
    ...(contents.images ?? []).map((image) => ({ name: image.name, data: image.data }))
  ]
}

/**
 * A `.fig` archive written as its reader asks for it, the images passing through as views of the
 * bytes given, so a save never holds the archive whole.
 */
export function streamFigArchive(contents: FigArchiveContents): ReadableStream<Uint8Array> {
  return zipStream(figArchiveEntries(contents))
}

/** Assemble a complete zipped `.fig` archive from an encoded Kiwi message and resources. */
export function writeFigArchive(input: WriteFigArchiveInput): Uint8Array {
  const canvasFig = buildFigKiwi(
    input.schemaDeflated,
    input.kiwiData,
    input.figKiwiVersion,
    input.compress,
    input.kind
  )
  const entries: Zippable = {}
  for (const entry of figArchiveEntries({ ...input, canvasFig })) {
    entries[entry.name] = entry.deflate ? entry.data : [entry.data, { level: 0 }]
  }
  return zipSync(entries)
}
