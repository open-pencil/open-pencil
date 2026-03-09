/**
 * Extract raw Kiwi bytes (schemaBytes, dataRaw) from .fig files.
 * Used by kiwi-decode and kiwi-equivalence tests.
 */

import { unzipSync, inflateSync } from 'fflate'
import { parseFigKiwiContainer } from '../../packages/core/src/kiwi/fig-file'

export interface KiwiFixture {
  schemaBytes: Uint8Array
  dataRaw: Uint8Array
}

/**
 * Extract schemaBytes (inflated) and dataRaw (decompressed) from a .fig file buffer.
 * Mirrors the extraction logic in fig-file.ts up to (but not including) decodeBinarySchema/decodeMessage.
 */
export function extractKiwiFixture(buffer: ArrayBuffer): KiwiFixture {
  const zip = unzipSync(new Uint8Array(buffer))
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
  return {
    schemaBytes,
    dataRaw: payload.dataRaw
  }
}
