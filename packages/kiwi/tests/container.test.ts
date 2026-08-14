import { describe, expect, test } from 'bun:test'

import { deflateSync } from 'fflate'

import {
  buildFigKiwi,
  decompressFigKiwiData,
  decompressFigKiwiDataAsync,
  FIG_KIWI_DEFAULT_VERSION,
  parseFigKiwiChunks
} from '../src/fig/container'

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

  test('rejects non fig-kiwi data', () => {
    expect(parseFigKiwiChunks(new TextEncoder().encode('not-fig-kiwi'))).toBeNull()
  })
})
