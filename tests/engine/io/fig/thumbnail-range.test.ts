import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { zipSync } from 'fflate'

import { extractFigThumbnailFromReader } from '@open-pencil/fig'

function memoryReader(bytes: Uint8Array, ranges: Array<[number, number]>) {
  return {
    size: bytes.byteLength,
    async read(start: number, endExclusive: number) {
      ranges.push([start, endExclusive])
      return bytes.slice(start, endExclusive)
    }
  }
}

describe('fig ranged thumbnail extraction', () => {
  test('extracts thumbnail.png without reading the complete fig', async () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/gold-preview.fig'))
    const ranges: Array<[number, number]> = []
    const thumbnail = await extractFigThumbnailFromReader(memoryReader(bytes, ranges), {
      maxTailBytes: 4 * 1024 * 1024
    })

    expect(thumbnail?.subarray(0, 8)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
    expect(ranges.length).toBeGreaterThanOrEqual(2)
    expect(ranges.every(([start, end]) => start !== 0 || end !== bytes.byteLength)).toBe(true)
    expect(ranges.reduce((total, [start, end]) => total + end - start, 0)).toBeLessThan(
      bytes.byteLength
    )
  })

  test('rejects malformed thumbnail payloads', async () => {
    const bytes = zipSync({
      'canvas.fig': new Uint8Array([1]),
      'thumbnail.png': new TextEncoder().encode('not a png')
    })
    expect(await extractFigThumbnailFromReader(memoryReader(bytes, []))).toBeNull()
  })

  test('returns null when deflated thumbnail data is corrupt', async () => {
    const png = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...Array.from({ length: 64 }, () => 1)
    ])
    const bytes = zipSync({ 'thumbnail.png': png })
    const name = new TextEncoder().encode('thumbnail.png')
    const nameOffset = bytes.findIndex((byte, index) =>
      name.every((nameByte, nameIndex) => bytes[index + nameIndex] === nameByte)
    )
    const headerOffset = nameOffset - 30
    const header = new DataView(bytes.buffer, bytes.byteOffset + headerOffset, 30)
    expect(header.getUint16(8, true)).toBe(8)
    const dataOffset = nameOffset + name.byteLength + header.getUint16(28, true)
    bytes.fill(0xff, dataOffset, dataOffset + header.getUint32(18, true))

    expect(await extractFigThumbnailFromReader(memoryReader(bytes, []))).toBeNull()
  })

  test('rejects thumbnails above configured output limits', async () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/gold-preview.fig'))
    const thumbnail = await extractFigThumbnailFromReader(memoryReader(bytes, []), {
      maxOutputBytes: 32
    })
    expect(thumbnail).toBeNull()
  })
})
