import { unzipSync, inflateSync } from 'fflate'
import { decompress as zstdDecompress } from 'fzstd'

import { importNodeChanges } from './fig-import'
import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi-schema'
import { isZstdCompressed } from './protocol'
import { profileStage, profileStart } from './fig-parse-profile'

import { SceneGraph } from '../scene-graph'
import type { FigmaMessage } from './codec'

export interface FigKiwiPayload {
  schemaDeflated: Uint8Array
  dataRaw: Uint8Array
}

/**
 * Parse fig-kiwi container from canvas data.
 * Exported for test fixture extraction (extract-kiwi-fixture).
 */
export function parseFigKiwiContainer(data: Uint8Array): FigKiwiPayload | null {
  const header = new TextDecoder().decode(data.subarray(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < data.length) {
    const len = view.getUint32(offset, true)
    offset += 4
    chunks.push(data.subarray(offset, offset + len))
    offset += len
  }
  if (chunks.length < 2) return null

  const compressed = chunks[1]
  let dataRaw: Uint8Array
  if (isZstdCompressed(compressed)) {
    dataRaw = zstdDecompress(compressed)
  } else {
    try {
      dataRaw = inflateSync(compressed)
    } catch {
      dataRaw = compressed
    }
  }

  return { schemaDeflated: chunks[0], dataRaw }
}

export async function parseFigFile(buffer: ArrayBuffer): Promise<SceneGraph> {
  const t0 = profileStart()
  const zip = unzipSync(new Uint8Array(buffer), {
    filter: (file) =>
      file.name === 'canvas.fig' ||
      file.name === 'canvas' ||
      (file.name.startsWith('images/') && file.name !== 'images/')
  })
  profileStage('1_unzipSync', t0)

  const entries = Object.keys(zip)
  let canvasData: Uint8Array | null = null
  for (const name of entries) {
    if (name === 'canvas.fig' || name === 'canvas') {
      canvasData = zip[name]
      break
    }
  }
  if (!canvasData) {
    let maxSize = 0
    for (const name of entries) {
      const lower = name.toLowerCase()
      if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.json')) continue
      if (zip[name].byteLength > maxSize) {
        maxSize = zip[name].byteLength
        canvasData = zip[name]
      }
    }
  }
  if (!canvasData) {
    throw new Error(`No canvas data found in .fig file. Entries: ${entries.join(', ')}`)
  }
  const payload = parseFigKiwiContainer(canvasData)
  if (!payload) throw new Error('Invalid fig-kiwi container')

  const t2 = profileStart()
  const schemaBytes = inflateSync(payload.schemaDeflated)
  profileStage('2_inflateSchema', t2)

  let message: FigmaMessage
  const t3 = profileStart()
  try {
    const wasm = await import('@open-pencil/kiwi-wasm')
    await wasm.default()
    message = wasm.decode_figma_message(schemaBytes, payload.dataRaw) as FigmaMessage
    profileStage('3_kiwiDecode_wasm', t3)
  } catch {
    const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
    const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
    message = compiled.decodeMessage(payload.dataRaw) as FigmaMessage
    profileStage('3_kiwiDecode_js', t3)
  }

  const nodeChanges = message.nodeChanges
  if (!nodeChanges || nodeChanges.length === 0) {
    throw new Error('No nodes found in .fig file')
  }

  const blobs: Uint8Array[] = (message.blobs ?? []).map((b) =>
    b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
  )

  const images = new Map<string, Uint8Array>()
  for (const name of entries) {
    if (name.startsWith('images/') && name !== 'images/') {
      images.set(name.replace('images/', ''), zip[name])
    }
  }

  const t4 = profileStart()
  const graph = importNodeChanges(nodeChanges, blobs, images)
  profileStage('4_importNodeChanges', t4)
  return graph
}

/**
 * Read a .fig File object and parse it
 */
export async function readFigFile(file: File): Promise<SceneGraph> {
  const buffer = await file.arrayBuffer()
  return parseFigFile(buffer)
}

type ProfileStages = Array<{ stage: string; ms: number }>

/**
 * Run a single worker stage, returning its success payload.
 * The worker is always terminated after it posts back (success or error).
 */
function runWorkerStage<TIn, TOut>(
  url: URL,
  input: TIn,
  transfer: Transferable[]
): Promise<TOut & { profile?: ProfileStages }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ type: string; message?: string; profile?: ProfileStages } & TOut>) => {
      worker.terminate()
      if (e.data.type === 'success') {
        resolve(e.data)
      } else if (e.data.type === 'error' && e.data.message) {
        reject(new Error(e.data.message))
      } else {
        reject(new Error('Unknown worker response'))
      }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err) }
    worker.postMessage(input, { transfer })
  })
}

/**
 * Parse a .fig file using a 3-stage Worker pipeline.
 * Each worker is terminated before the next starts, freeing VRAM/memory.
 *
 * Stage 1 (unzip):  .fig buffer → schema bytes + kiwi data + images
 * Stage 2 (parse):  kiwi decode + importNodeChanges → serialized SceneGraph
 * Stage 3 (layout): computeAllLayouts → final serialized SceneGraph
 *
 * Pass profile: true to collect and return stage timings.
 */
export async function parseFigFileInWorker(
  buffer: ArrayBuffer,
  options?: { profile?: boolean }
): Promise<SceneGraph> {
  const profile = options?.profile ?? false
  const allStages: ProfileStages = []

  // Stage 1: Unzip
  type S1Out = { schemaBytes: Uint8Array; dataRaw: Uint8Array; images: Array<[string, Uint8Array]> }
  const s1 = await runWorkerStage<unknown, S1Out>(
    new URL('./fig-unzip.worker.ts', import.meta.url),
    { buffer, profile },
    [buffer]
  )
  if (s1.profile) allStages.push(...s1.profile)

  // Stage 2: Kiwi decode + import
  const s2Transfer: Transferable[] = []
  const seen = new Set<ArrayBuffer>()
  for (const buf of [s1.schemaBytes.buffer as ArrayBuffer, s1.dataRaw.buffer as ArrayBuffer]) {
    if (!seen.has(buf)) { seen.add(buf); s2Transfer.push(buf) }
  }
  for (const [, bytes] of s1.images) {
    const buf = bytes.buffer as ArrayBuffer
    if (!seen.has(buf)) { seen.add(buf); s2Transfer.push(buf) }
  }

  type S2Out = { data: Parameters<typeof SceneGraph.fromPlainData>[0] }
  const s2 = await runWorkerStage<unknown, S2Out>(
    new URL('./fig-parse.worker.ts', import.meta.url),
    { schemaBytes: s1.schemaBytes, dataRaw: s1.dataRaw, images: s1.images, profile },
    s2Transfer
  )
  if (s2.profile) allStages.push(...s2.profile)

  // Stage 3: Layout
  const s3Transfer: Transferable[] = []
  const seen3 = new Set<ArrayBuffer>()
  for (const [, bytes] of s2.data.images) {
    const buf = bytes.buffer as ArrayBuffer
    if (!seen3.has(buf)) { seen3.add(buf); s3Transfer.push(buf) }
  }

  type S3Out = { data: Parameters<typeof SceneGraph.fromPlainData>[0] }
  const s3 = await runWorkerStage<unknown, S3Out>(
    new URL('./fig-layout.worker.ts', import.meta.url),
    { data: s2.data, profile },
    s3Transfer
  )
  if (s3.profile) allStages.push(...s3.profile)

  if (profile && allStages.length > 0) {
    ;(globalThis as unknown as { __FIG_PARSE_PROFILE_RESULT__?: ProfileStages }).__FIG_PARSE_PROFILE_RESULT__ = allStages
  }

  return SceneGraph.fromPlainData(s3.data)
}

