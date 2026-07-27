import { describe, expect, test } from 'bun:test'

import {
  STORAGE_DOCUMENTS_PREFIX,
  STORAGE_NAMESPACE,
  STORAGE_NAMESPACE_MARKER,
  documentFigKey,
  documentIdFromFigKey,
  documentMetaKey,
  documentThumbnailKey
} from '@/app/integrations/storage/namespace'

describe('storage namespace', () => {
  test('uses the fixed open_pencil_storage prefix', () => {
    expect(STORAGE_NAMESPACE).toBe('open_pencil_storage')
    expect(STORAGE_NAMESPACE_MARKER.startsWith(`${STORAGE_NAMESPACE}/`)).toBe(true)
    expect(STORAGE_DOCUMENTS_PREFIX).toBe('open_pencil_storage/canvases/')
  })

  test('builds document object keys inside the namespace', () => {
    const id = 'abc-123'
    expect(documentFigKey(id)).toBe('open_pencil_storage/canvases/abc-123.fig')
    expect(documentMetaKey(id)).toBe('open_pencil_storage/canvases/abc-123.meta.json')
    expect(documentThumbnailKey(id)).toBe('open_pencil_storage/canvases/abc-123.thumb.jpg')
  })

  test('parses document IDs from fig keys and ignores foreign keys', () => {
    expect(documentIdFromFigKey('open_pencil_storage/canvases/uuid-1.fig')).toBe('uuid-1')
    expect(documentIdFromFigKey('other_prefix/canvases/uuid-1.fig')).toBeNull()
    expect(documentIdFromFigKey('open_pencil_storage/canvases/nested/uuid-1.fig')).toBeNull()
    expect(documentIdFromFigKey('open_pencil_storage/canvases/uuid-1.meta.json')).toBeNull()
  })
})
