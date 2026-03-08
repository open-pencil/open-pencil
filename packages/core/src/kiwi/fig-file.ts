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

  const t1 = profileStart()
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

  const blobs: Uint8Array[] = (
    ((message as unknown as Record<string, unknown>).blobs as Array<{ bytes: Uint8Array }>) ?? []
  ).map((b) =>
    b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes) as number[])
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

/**
 * Parse a .fig file in a Web Worker to keep the main thread responsive.
 * Use when `typeof Worker !== 'undefined'` (browser). Falls back not supported — call parseFigFile directly.
 * Pass profile: true to collect and return stage timings (for performance investigation).
 */
export function parseFigFileInWorker(
  buffer: ArrayBuffer,
  options?: { profile?: boolean }
): Promise<SceneGraph> {
  const profile = options?.profile ?? false
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fig-file.worker.ts', import.meta.url), {
      type: 'module'
    })
    worker.onmessage = (e: MessageEvent<{ type: string; data?: unknown; message?: string; profile?: Array<{ stage: string; ms: number }> }>) => {
      worker.terminate()
      if (e.data.type === 'success' && e.data.data) {
        if (profile && e.data.profile) {
          ;(globalThis as unknown as { __FIG_PARSE_PROFILE_RESULT__?: Array<{ stage: string; ms: number }> }).__FIG_PARSE_PROFILE_RESULT__ =
            e.data.profile
        }
        resolve(SceneGraph.fromPlainData(e.data.data as Parameters<typeof SceneGraph.fromPlainData>[0]))
      } else if (e.data.type === 'error' && e.data.message) {
        reject(new Error(e.data.message))
      } else {
        reject(new Error('Unknown worker response'))
      }
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }
    worker.postMessage(profile ? { buffer, profile: true } : buffer, { transfer: [buffer] })
  })
}

