import { inflateSync } from 'fflate'

import {
  decodeBinarySchema,
  compileSchema,
  ByteBuffer,
  type HeaderFields,
  type RuntimeMessage
} from '../schema-runtime'
import type { NodeChange } from './codec'
import { decompressFigKiwiData } from './container'
import { extractFigPageManifest, type FigPageManifestEntry } from './page-manifest'

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

  return { schemaDeflated: chunks[0], dataRaw: decompressFigKiwiData(chunks[1]), version }
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
  )
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
  onPages?: (pages: FigPageManifestEntry[]) => void,
  headers?: HeaderFields
): FigKiwiDecodeResult {
  const payload = parseFigKiwiContainer(data)
  if (!payload) throw new Error('Invalid fig-kiwi container')

  const schemaBytes = inflateSync(payload.schemaDeflated)
  const compiled = compileSchema(decodeBinarySchema(new ByteBuffer(schemaBytes)), headers)
  if (onPages) {
    try {
      const pages = extractFigPageManifest(compiled.schema, payload.dataRaw)
      if (pages.length > 0) onPages(pages)
    } catch (error) {
      console.warn('Failed to scan FIG page manifest; continuing with full decode:', error)
    }
  }
  if (!compiled.decodeMessage) throw new Error('The fig-kiwi schema has no Message')
  const message = compiled.decodeMessage(payload.dataRaw)

  const records = message.nodeChanges
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No nodes found in .fig file')
  }
  const nodeChanges = records as NodeChange[]
  deduplicateNodeChangePluginData(nodeChanges)

  const blobs: Uint8Array[] = (Array.isArray(message.blobs) ? message.blobs : []).map((blob) => {
    const bytes = isRuntimeMessage(blob) ? blob.bytes : undefined
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(Object.values(bytes ?? {}))
  })

  return {
    nodeChanges,
    blobs,
    figKiwiVersion: payload.version,
    figSchemaDeflated: payload.schemaDeflated
  }
}
