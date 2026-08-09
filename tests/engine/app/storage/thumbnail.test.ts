import { describe, expect, test } from 'bun:test'

import { zipSync } from 'fflate'

import { extractStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const dimensions = new DataView(bytes.buffer)
  dimensions.setUint32(16, width)
  dimensions.setUint32(20, height)
  return bytes
}

describe('storage thumbnails', () => {
  test('extracts thumbnail.png without decoding the document payload', () => {
    const thumbnail = pngHeader(400, 225)
    const archive = zipSync({
      'canvas.fig': new Uint8Array([1, 2, 3]),
      'thumbnail.png': thumbnail
    })

    expect(extractStorageThumbnail(archive)).toEqual(thumbnail)
  })

  test('rejects the 1×1 native-export placeholder', () => {
    expect(isUsableStorageThumbnail(pngHeader(1, 1))).toBe(false)
    expect(isUsableStorageThumbnail(pngHeader(400, 225))).toBe(true)
  })
})
