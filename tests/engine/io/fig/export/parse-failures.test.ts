import { describe, expect, test } from 'bun:test'

import { parseFigKiwiContainer } from '#core/kiwi/fig/parse/core'

/**
 * Build a minimal fig-kiwi container with a valid header + schema chunk
 * but a corrupt (non-compressible) data chunk that will cause inflateSync
 * to throw. This verifies that the decompressor does NOT silently fall
 * back to raw compressed bytes.
 */
function buildCorruptFigKiwi(): Uint8Array {
  const schemaDeflated = new Uint8Array([0x78, 0x01, 0x01, 0x00, 0x00]) // minimal deflate
  // Data chunk: random bytes that are neither valid zlib nor valid zstd
  const dataCorrupt = new Uint8Array(32)
  for (let i = 0; i < dataCorrupt.length; i++) dataCorrupt[i] = (i * 37) & 0xff

  const header = new TextEncoder().encode('fig-kiwi')
  const version = new Uint32Array([101])
  const schemaLen = new Uint32Array([schemaDeflated.length])
  const dataLen = new Uint32Array([dataCorrupt.length])

  const total = 8 + 4 + 4 + schemaDeflated.length + 4 + dataCorrupt.length
  const out = new Uint8Array(total)
  let offset = 0
  out.set(header, offset)
  offset += 8
  out.set(new Uint8Array(version.buffer), offset)
  offset += 4
  out.set(new Uint8Array(schemaLen.buffer), offset)
  offset += 4
  out.set(schemaDeflated, offset)
  offset += schemaDeflated.length
  out.set(new Uint8Array(dataLen.buffer), offset)
  offset += 4
  out.set(dataCorrupt, offset)

  return out
}

describe('parseFigKiwiContainer: decompression failures', () => {
  test('throws on corrupt data chunk (not raw bytes)', () => {
    const buf = buildCorruptFigKiwi()
    expect(() => parseFigKiwiContainer(buf)).toThrow()
  })

  test('returns null for missing header', () => {
    const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    expect(parseFigKiwiContainer(buf)).toBeNull()
  })

  test('returns null for fewer than 2 chunks', () => {
    const header = new TextEncoder().encode('fig-kiwi')
    const version = new Uint32Array([101])
    const schemaDeflated = new Uint8Array([0x78, 0x01])
    const schemaLen = new Uint32Array([schemaDeflated.length])
    // No data chunk — only one chunk total

    const total = 8 + 4 + 4 + schemaDeflated.length
    const out = new Uint8Array(total)
    let offset = 0
    out.set(header, offset)
    offset += 8
    out.set(new Uint8Array(version.buffer), offset)
    offset += 4
    out.set(new Uint8Array(schemaLen.buffer), offset)
    offset += 4
    out.set(schemaDeflated, offset)

    expect(parseFigKiwiContainer(out)).toBeNull()
  })
})
