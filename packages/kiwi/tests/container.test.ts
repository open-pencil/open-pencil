import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import {
  buildFigKiwi,
  decompressFigKiwiData,
  decompressFigKiwiDataAsync,
  FIG_KIWI_DEFAULT_VERSION,
  loadFigDataCompressor,
  loadFigDataDecompressor,
  loadWasmFigDataCompressor,
  loadWasmFigDataDecompressor,
  parseFigKiwiChunks,
  type FigDataCompressor
} from '../src/fig/container'
import { isZstdCompressed } from '../src/fig/protocol'

/** Text that compresses better the harder zstd works, generated the same way every run. */
function sampleDocument(): Uint8Array {
  let seed = 1
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31)
  const records = Array.from(
    { length: 4000 },
    () => `{"name":"Layer ${next() % 500}","x":${next() % 2000},"fills":[${next() % 7}]}`
  )
  return new TextEncoder().encode(records.join('\n'))
}

/** Whether a zstd frame header records the decompressed size, which Figma requires. */
function declaresContentSize(frame: Uint8Array): boolean {
  const descriptor = frame[4]
  const singleSegment = (descriptor >> 5) & 1
  return singleSegment === 1 || descriptor >> 6 !== 0
}

/**
 * A zstd frame of one raw block that declares no content size (RFC 8878 §3.1.1): a frame header
 * descriptor with every flag clear, a window descriptor, and a last raw block of `data`.
 */
function rawZstdFrameWithoutContentSize(data: Uint8Array): Uint8Array {
  const blockHeader = 1 | (0 << 1) | (data.length << 3)
  return new Uint8Array([
    0x28,
    0xb5,
    0x2f,
    0xfd,
    0x00,
    0x70,
    blockHeader & 0xff,
    (blockHeader >> 8) & 0xff,
    (blockHeader >> 16) & 0xff,
    ...data
  ])
}

describe('Figma FIG Kiwi container helpers', () => {
  test('builds and parses fig-kiwi chunks', async () => {
    const schemaDeflated = new Uint8Array([1, 2, 3])
    const dataRaw = new TextEncoder().encode('payload')
    const binary = buildFigKiwi(schemaDeflated, dataRaw)

    const chunks = parseFigKiwiChunks(binary)

    expect(chunks).not.toBeNull()
    expect(chunks?.[0]).toEqual(schemaDeflated)
    // A well-formed fig-kiwi container always carries a payload chunk; dereference it
    // explicitly so a missing second chunk fails the test directly instead of being
    // masked by an empty-buffer fallback.
    const dataChunk = chunks?.[1]
    expect(dataChunk).toBeInstanceOf(Uint8Array)
    expect(dataChunk?.length).toBeGreaterThan(0)
    expect(decompressFigKiwiData(dataChunk as Uint8Array)).toEqual(dataRaw)
    await expect(decompressFigKiwiDataAsync(dataChunk as Uint8Array)).resolves.toEqual(dataRaw)
  })

  test('uses the default container version', () => {
    const binary = buildFigKiwi(new Uint8Array([1]), new Uint8Array([2]))
    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength)

    expect(view.getUint32(8, true)).toBe(FIG_KIWI_DEFAULT_VERSION)
  })

  test('decompresses deflated data synchronously and asynchronously', async () => {
    const dataRaw = new TextEncoder().encode('payload')
    const deflated = deflateSync(dataRaw)

    expect(decompressFigKiwiData(deflated)).toEqual(dataRaw)
    await expect(decompressFigKiwiDataAsync(deflated)).resolves.toEqual(dataRaw)
  })

  // Bun's own zstd where it runs, and the WebAssembly build browsers and webviews save with.
  for (const [encoder, load] of [
    ['native', loadFigDataCompressor],
    ['WebAssembly', loadWasmFigDataCompressor]
  ] as const satisfies ReadonlyArray<
    readonly [string, (level: number) => Promise<FigDataCompressor>]
  >) {
    test(`${encoder} zstd compresses at the requested level into frames Figma opens`, async () => {
      const dataRaw = sampleDocument()
      const sizes: number[] = []
      for (const level of [3, 9, 19]) {
        const compress = await load(level)
        const binary = buildFigKiwi(
          new Uint8Array([1]),
          dataRaw,
          FIG_KIWI_DEFAULT_VERSION,
          compress
        )
        const dataChunk = parseFigKiwiChunks(binary)?.[1] ?? new Uint8Array()
        expect(isZstdCompressed(dataChunk)).toBe(true)
        expect(declaresContentSize(dataChunk)).toBe(true)
        expect(decompressFigKiwiData(dataChunk)).toEqual(dataRaw)
        sizes.push(dataChunk.length)
      }
      expect(sizes[1]).toBeLessThan(sizes[0])
      expect(sizes[2]).toBeLessThan(sizes[1])
    })
  }

  test('rejects non fig-kiwi data', () => {
    expect(parseFigKiwiChunks(new TextEncoder().encode('not-fig-kiwi'))).toBeNull()
  })

  // Bun's own zstd where it runs, and the WebAssembly build browsers and webviews read with.
  for (const [decoder, load] of [
    ['native', loadFigDataDecompressor],
    ['WebAssembly', loadWasmFigDataDecompressor]
  ] as const) {
    test(`${decoder} zstd decompresses every level, and deflate, synchronously`, async () => {
      const dataRaw = sampleDocument()
      const decompress = await load()
      for (const level of [3, 19]) {
        const compress = await loadWasmFigDataCompressor(level)
        expect(decompress(compress(dataRaw))).toEqual(dataRaw)
      }
      expect(decompress(deflateSync(dataRaw))).toEqual(dataRaw)
    })

    // A Node Buffer slices into views of the whole message, which structuredClone then copies in
    // full for every byte array a record holds; a plain Uint8Array slices by copying.
    test(`${decoder} zstd returns a plain Uint8Array whose slice is a copy`, async () => {
      const dataRaw = sampleDocument()
      const decompress = await load()
      const compress = await loadWasmFigDataCompressor(3)

      const decompressed = decompress(compress(dataRaw))

      expect(Object.getPrototypeOf(decompressed)).toBe(Uint8Array.prototype)
      expect(decompressed.slice(0, 8).buffer.byteLength).toBe(8)
    })

    // Figma writes the size, but a frame from another tool may not; the decoder streams those.
    test(`${decoder} zstd decompresses a frame that declares no content size`, async () => {
      const dataRaw = new TextEncoder().encode('payload without a declared size')
      const frame = rawZstdFrameWithoutContentSize(dataRaw)
      expect(isZstdCompressed(frame)).toBe(true)
      expect(declaresContentSize(frame)).toBe(false)

      const decompress = await load()

      expect(decompress(frame)).toEqual(dataRaw)
    })
  }
})
