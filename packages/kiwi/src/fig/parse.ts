import { inflateSync } from 'fflate'
import { decompress as zstdDecompress } from 'fzstd'

import { decodeBinarySchema, compileSchema, ByteBuffer } from '../schema-runtime'
import type { FigmaMessage, NodeChange } from './codec'
import { extractFigPageManifest, type FigPageManifestEntry } from './page-manifest'
import { isZstdCompressed } from './protocol'

export type { NodeChange } from './codec'

/**
 * Deduplicates pluginData/pluginRelaunchData entries on raw NodeChange objects.
 * Some .fig files have millions of identical entries where only a small
 * fraction are unique by full triple.
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
        map.set(`${entry.pluginID}\0${entry.command}\0${entry.message}\0${entry.isDeleted}`, entry)
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

interface CompiledKiwiSchema {
  decodeMessage(data: Uint8Array): unknown
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
      throw new Error('Failed to decompress fig-kiwi data chunk')
    }
  }

  return { schemaDeflated: chunks[0], dataRaw, version }
}

export interface FigKiwiDecodeResult {
  nodeChanges: NodeChange[]
  blobs: Uint8Array[]
  figKiwiVersion: number
  /** Deflated kiwi schema bytes from the original file (for roundtrip fidelity). */
  figSchemaDeflated: Uint8Array
}

/** Decode one raw `fig-kiwi` canvas payload. Outer `.fig` archive handling lives in `@open-pencil/fig`. */
export function decodeFigKiwiCanvas(
  data: Uint8Array,
  onPages?: (pages: FigPageManifestEntry[]) => void
): FigKiwiDecodeResult {
  const payload = parseFigKiwiContainer(data)
  if (!payload) throw new Error('Invalid fig-kiwi container')

  const schemaBytes = inflateSync(payload.schemaDeflated)
  const schema = decodeBinarySchema(new ByteBuffer(schemaBytes))
  if (onPages) {
    try {
      const pages = extractFigPageManifest(schema, payload.dataRaw)
      if (pages.length > 0) onPages(pages)
    } catch (error) {
      console.warn('Failed to scan FIG page manifest; continuing with full decode:', error)
    }
  }
  const compiled = compileSchema(schema) as CompiledKiwiSchema
  const message = compiled.decodeMessage(payload.dataRaw) as FigmaMessage

  const nodeChanges = message.nodeChanges
  if (!nodeChanges || nodeChanges.length === 0) {
    throw new Error('No nodes found in .fig file')
  }

  deduplicateNodeChangePluginData(nodeChanges)

  const blobs: Uint8Array[] = (message.blobs ?? []).map((blob) =>
    blob.bytes instanceof Uint8Array ? blob.bytes : new Uint8Array(Object.values(blob.bytes))
  )

  return {
    nodeChanges,
    blobs,
    figKiwiVersion: payload.version,
    figSchemaDeflated: payload.schemaDeflated
  }
}
