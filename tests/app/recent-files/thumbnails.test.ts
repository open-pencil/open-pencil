import 'fake-indexeddb/auto'
import { describe, expect, spyOn, test } from 'bun:test'

import type * as Thumbnails from '@/app/recent-files/thumbnails'

/** A 512 × 320 preview, so caching really reaches IndexedDB. */
const PNG_PREVIEW = new Uint8Array(64)
PNG_PREVIEW.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
new DataView(PNG_PREVIEW.buffer).setUint32(16, 512)
new DataView(PNG_PREVIEW.buffer).setUint32(20, 320)

describe('recent file thumbnails without IndexedDB', () => {
  test('load, cache, and clear log and resolve instead of rejecting', async () => {
    const open = spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('IndexedDB unavailable')
    })
    // A fresh module copy, so no connection opened by another test is reused.
    const freshCopy = '@/app/recent-files/thumbnails.ts?unavailable'
    const thumbnails = (await import(freshCopy)) as typeof Thumbnails
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(await thumbnails.loadCachedRecentFileThumbnail('design.fig')).toBeNull()
      await thumbnails.cacheRecentFileThumbnail('design.fig', PNG_PREVIEW)
      await thumbnails.clearRecentFileThumbnails()
      expect(warn.mock.calls.length).toBe(3)
      expect(open.mock.calls.length).toBe(3)
    } finally {
      warn.mockRestore()
      open.mockRestore()
    }
  })
})
