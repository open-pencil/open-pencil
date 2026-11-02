import type { Zstd } from '@hpcc-js/wasm-zstd'
import { deflateSync, inflateSync } from 'fflate'

import { isZstdCompressed } from './protocol'

export const FIG_KIWI_DEFAULT_VERSION = 101

/**
 * The header a canvas starts with. Figma's design files and FigJam boards differ only here:
 * a board's `.jam` archive holds the same records under `fig-jam.`.
 */
export const FIG_FILE_HEADERS = { design: 'fig-kiwi', board: 'fig-jam.' } as const

/** What a canvas is for, by its header. */
export type FigFileKind = keyof typeof FIG_FILE_HEADERS

/** The kind a canvas's header names, or null when it is no Figma canvas. */
export function figFileKind(binary: Uint8Array): FigFileKind | null {
  const header = new TextDecoder().decode(binary.slice(0, 8))
  if (header === FIG_FILE_HEADERS.design) return 'design'
  if (header === FIG_FILE_HEADERS.board) return 'board'
  return null
}

/** Compresses a fig-kiwi data chunk. */
export type FigDataCompressor = (data: Uint8Array) => Uint8Array

/** Decompresses a fig-kiwi data chunk, zstd or deflate. */
export type FigDataDecompressor = (data: Uint8Array) => Uint8Array

/** The zstd level Figma itself saves with. */
export const FIG_ZSTD_DEFAULT_LEVEL = 3

type BunZstdCompress = (data: Uint8Array, options?: { level?: number }) => Uint8Array
type BunZstdDecompress = (data: Uint8Array) => Uint8Array

function bunZstdCompress(): BunZstdCompress | undefined {
  const g = globalThis as { Bun?: { zstdCompressSync?: BunZstdCompress } }
  return g.Bun?.zstdCompressSync
}

function bunZstdDecompress(): BunZstdDecompress | undefined {
  const g = globalThis as { Bun?: { zstdDecompressSync?: BunZstdDecompress } }
  return g.Bun?.zstdDecompressSync
}

/**
 * Bun's zstd at its default level, or deflate where zstd needs loading first. Figma reads both,
 * so writers that cannot wait, such as the clipboard, use this one.
 */
export const defaultFigDataCompressor: FigDataCompressor = (data) =>
  bunZstdCompress()?.(data) ?? deflateSync(data)

let wasmZstd: Zstd | undefined
let wasmZstdLoading: Promise<Zstd> | undefined

/** The WebAssembly zstd, loaded once; a failed load is retried on the next call. */
function loadWasmZstd(): Promise<Zstd> {
  wasmZstdLoading ??= import('@hpcc-js/wasm-zstd')
    .then(({ Zstd }) => Zstd.load())
    .then((zstd) => (wasmZstd = zstd))
    .catch((error: unknown) => {
      wasmZstdLoading = undefined
      throw error
    })
  return wasmZstdLoading
}

/** The WebAssembly zstd encoder at `level`. */
export async function loadWasmFigDataCompressor(
  level = FIG_ZSTD_DEFAULT_LEVEL
): Promise<FigDataCompressor> {
  const zstd = await loadWasmZstd()
  return (data) => zstd.compress(data, level)
}

/**
 * A zstd compressor at `level`: Bun's own where it runs, the WebAssembly build elsewhere. Figma
 * opens every level, but only frames that declare their decompressed size, which both write.
 */
export async function loadFigDataCompressor(
  level = FIG_ZSTD_DEFAULT_LEVEL
): Promise<FigDataCompressor> {
  const native = bunZstdCompress()
  if (native) return (data) => native(data, { level })
  return loadWasmFigDataCompressor(level)
}

/** The WebAssembly zstd decoder. */
export async function loadWasmFigDataDecompressor(): Promise<FigDataDecompressor> {
  const zstd = await loadWasmZstd()
  return (data) => (isZstdCompressed(data) ? zstd.decompress(data) : inflate(data))
}

/**
 * Makes `decompressFigKiwiData` ready for zstd chunks: Bun's own zstd needs nothing, the
 * WebAssembly build elsewhere loads once. Every path that opens a `.fig` synchronously awaits
 * this first, so a document session, its worker, and the patches they write never wait.
 */
export async function loadFigDataDecompressor(): Promise<FigDataDecompressor> {
  if (!bunZstdDecompress()) await loadWasmZstd()
  return decompressFigKiwiData
}

function inflate(compressed: Uint8Array): Uint8Array {
  try {
    return inflateSync(compressed)
  } catch {
    throw new Error('Failed to decompress fig-kiwi data')
  }
}

function decompressZstd(compressed: Uint8Array): Uint8Array {
  const native = bunZstdDecompress()
  if (native) {
    // Bun returns a Node Buffer, whose `slice` is a view: a reader slicing byte arrays out of
    // the message would then hand out views of the whole message, which `structuredClone`
    // copies in full each time. A plain Uint8Array over the same memory slices by copying.
    const buffer = native(compressed)
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }
  if (!wasmZstd)
    throw new Error('Zstd is not loaded: await loadFigDataDecompressor() before reading')
  return wasmZstd.decompress(compressed)
}

export function parseFigKiwiChunks(binary: Uint8Array): Uint8Array[] | null {
  if (!figFileKind(binary)) return null

  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < binary.length) {
    const chunkLen = view.getUint32(offset, true)
    offset += 4
    chunks.push(binary.slice(offset, offset + chunkLen))
    offset += chunkLen
  }
  return chunks.length >= 2 ? chunks : null
}

/** A data chunk decompressed at once; a zstd chunk needs `loadFigDataDecompressor` first. */
export function decompressFigKiwiData(compressed: Uint8Array): Uint8Array {
  return isZstdCompressed(compressed) ? decompressZstd(compressed) : inflate(compressed)
}

export async function decompressFigKiwiDataAsync(compressed: Uint8Array): Promise<Uint8Array> {
  const decompress = await loadFigDataDecompressor()
  return decompress(compressed)
}

export function buildFigKiwi(
  schemaDeflated: Uint8Array,
  dataRaw: Uint8Array,
  version = FIG_KIWI_DEFAULT_VERSION,
  compress: FigDataCompressor = defaultFigDataCompressor,
  kind: FigFileKind = 'design'
): Uint8Array {
  const dataCompressed = compress(dataRaw)

  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataCompressed.length
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  out.set(new TextEncoder().encode(FIG_FILE_HEADERS[kind]), 0)
  view.setUint32(8, version, true)

  let offset = 12
  view.setUint32(offset, schemaDeflated.length, true)
  offset += 4
  out.set(schemaDeflated, offset)
  offset += schemaDeflated.length

  view.setUint32(offset, dataCompressed.length, true)
  offset += 4
  out.set(dataCompressed, offset)

  return out
}
