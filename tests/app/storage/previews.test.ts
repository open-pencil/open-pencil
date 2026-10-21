import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { usablePreview } from '@/app/document/io/preview-bytes'
import {
  DOCUMENT_THUMBNAIL_CONTENT_TYPE,
  documentThumbnailKey,
  legacyDocumentThumbnailKey
} from '@/app/integrations/storage/namespace'
import {
  cacheRecentFileThumbnail,
  clearRecentFileThumbnails,
  loadRecentFileThumbnail
} from '@/app/recent-files/thumbnails'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** PNG bytes whose header says `width` × `height`, as a preview's would. */
function png(width: number, height = width): Uint8Array {
  const bytes = new Uint8Array(64)
  bytes.set(PNG)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('design previews', () => {
  test('store PNG bytes under a PNG key with a PNG content type', () => {
    expect(documentThumbnailKey('a')).toEndWith('a.thumb.png')
    expect(legacyDocumentThumbnailKey('a')).toEndWith('a.thumb.jpg')
    expect(DOCUMENT_THUMBNAIL_CONTENT_TYPE).toBe('image/png')
  })

  test('treat a missing, 1×1 placeholder or non-PNG preview as missing', () => {
    expect(usablePreview(null)).toBeNull()
    expect(usablePreview(png(1))).toBeNull()
    expect(usablePreview(png(512, 1))).toBeNull()
    expect(usablePreview(new Uint8Array(4096))).toBeNull()
    const real = png(512, 320)
    expect(usablePreview(real)).toBe(real)
  })

  test('keep recent-file previews in the browser and never cache a blank one', async () => {
    await clearRecentFileThumbnails()
    await cacheRecentFileThumbnail('/designs/blank.fig', png(1))
    expect(await loadRecentFileThumbnail('/designs/blank.fig')).toBeNull()
    const real = png(512, 320)
    await cacheRecentFileThumbnail('/designs/real.fig', real)
    expect(await loadRecentFileThumbnail('/designs/real.fig')).toEqual(real)
    await clearRecentFileThumbnails()
    expect(await loadRecentFileThumbnail('/designs/real.fig')).toBeNull()
  })
})
