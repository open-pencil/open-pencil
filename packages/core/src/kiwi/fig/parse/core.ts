import { isZstdCompressed } from '#core/kiwi/binary/protocol'
import { decodeBinarySchema, compileSchema, ByteBuffer } from '#core/kiwi/kiwi-schema'
import { unzipSync, inflateSync } from 'fflate'
import { decompress as zstdDecompress } from 'fzstd'

import type { FigmaMessage, NodeChange } from '#core/kiwi/binary/codec'

/**
 * Deduplicates pluginData/pluginRelaunchData entries on raw NodeChange objects.
 * Some .fig files have millions of identical entries (e.g. slop-funnel.fig
 * has 10.9M entries where only ~5.5K are unique by full triple).
 * Full-triple key (id+key+value) preserves multi-entry subsystems like OkHCL.
 */
export function deduplicateNodeChangePluginData(nodeChanges: NodeChange[]): void {
  for (const nc of nodeChanges) {
    if (nc.pluginData && nc.pluginData.length > 1) {
      const map = new Map<string, (typeof nc.pluginData)[number]>()
      for (const entry of nc.pluginData) {
        map.set(`${entry.pluginID}\0${entry.key}\0${entry.value}`, entry)
      }
      if (map.size < nc.pluginData.length) {
        nc.pluginData = [...map.values()]
      }
    }
    if (nc.pluginRelaunchData && nc.pluginRelaunchData.length > 1) {
      const map = new Map<string, (typeof nc.pluginRelaunchData)[number]>()
      for (const entry of nc.pluginRelaunchData) {
        map.set(`${entry.pluginID}\0${entry.command}\0${entry.message}`, entry)
      }
      if (map.size < nc.pluginRelaunchData.length) {
        nc.pluginRelaunchData = [...map.values()]
      }
    }
  }
}

interface FigKiwiPayload {
  schemaDeflated: Uint8Array
  dataRaw: Uint8Array
  version: number
}

export function parseFigKiwiContainer(data: Uint8Array): FigKiwiPayload | null {
  const header = new TextDecoder().decode(data.slice(0, 8))
  if (header !== 'fig-kiwi') return null

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const version = view.getUint32(8, true)
  let offset = 12

  const chunks: Uint8Array[] = []
  while (offset < data.length) {
    if (offset + 4 > data.length) break
    const len = view.getUint32(offset, true)
    offset += 4
    if (offset + len > data.length) {
      throw new Error(
        `Corrupted .fig file: chunk at offset ${offset - 4} declares length ${len} but only ${data.length - offset} bytes remain`
      )
    }
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

  return { schemaDeflated: chunks[0], dataRaw, version }
}

export interface FigParseResult {
  nodeChanges: NodeChange[]
  blobs: Uint8Array[]
  images: Array<[string, Uint8Array]>
  figKiwiVersion: number
}

export function parseFigBuffer(buffer: ArrayBuffer): FigParseResult {
  const zip = unzipSync(new Uint8Array(buffer), {
    filter: (file) =>
      file.name === 'canvas.fig' ||
      file.name === 'canvas' ||
      (file.name.startsWith('images/') && file.name !== 'images/')
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

  // Deduplicate before returning — critical for worker path where raw
  // nodeChanges are serialized via postMessage before extractPluginData runs
  deduplicateNodeChangePluginData(nodeChanges)

  const blobs: Uint8Array[] = (message.blobs ?? []).map((b) =>
    b.bytes instanceof Uint8Array ? b.bytes : new Uint8Array(Object.values(b.bytes))
  )

  const images: Array<[string, Uint8Array]> = []
  for (const name of entries) {
    if (name.startsWith('images/') && name !== 'images/') {
      images.push([name.replace('images/', ''), zip[name]])
    }
  }

  return { nodeChanges, blobs, images, figKiwiVersion: payload.version }
}
