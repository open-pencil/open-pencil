import { unzipSync, inflateSync } from 'fflate'
import { decompress as zstdDecompress } from 'fzstd'

import { importNodeChanges } from './fig-import'
import { decodeBinarySchema, compileSchema, ByteBuffer } from './kiwi-schema'
import { isZstdCompressed } from './protocol'

import type { SceneGraph } from '../scene-graph'
import type { FigmaMessage } from './codec'

interface FigKiwiPayload {
  schemaDeflated: Uint8Array
  dataRaw: Uint8Array
}

function parseFigKiwiContainer(data: Uint8Array): FigKiwiPayload | null {
  const header = new TextDecoder().decode(data.slice(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < data.length) {
    const len = view.getUint32(offset, true)
    offset += 4
    chunks.push(data.slice(offset, offset + len))
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
  const zip = unzipSync(new Uint8Array(buffer), {
    filter: (file) =>
      file.name === 'canvas.fig' ||
      file.name === 'canvas' ||
      (file.name.startsWith('images/') && file.name !== 'images/'),
  })
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

  const schemaBytes = inflateSync(payload.schemaDeflated)
  const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
  const compiled = compileSchema(schema) as { decodeMessage(data: Uint8Array): unknown }
  const message = compiled.decodeMessage(payload.dataRaw) as FigmaMessage

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

  return importNodeChanges(nodeChanges, blobs, images)
}

/**
 * Read a .fig File object and parse it
 */
export async function readFigFile(file: File): Promise<SceneGraph> {
  const buffer = await file.arrayBuffer()
  return parseFigFile(buffer)
}
