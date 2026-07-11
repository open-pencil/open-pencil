import { describe, expect, test } from 'bun:test'

import {
  CLOUD_CANVASES_PREFIX,
  CLOUD_NAMESPACE,
  CLOUD_NAMESPACE_MARKER,
  canvasFigKey,
  canvasIdFromFigKey,
  canvasMetaKey,
  canvasThumbKey
} from '@/app/cloud/namespace'

describe('cloud namespace', () => {
  test('uses fixed open_pencil_storage prefix', () => {
    expect(CLOUD_NAMESPACE).toBe('open_pencil_storage')
    expect(CLOUD_NAMESPACE_MARKER.startsWith(`${CLOUD_NAMESPACE}/`)).toBe(true)
    expect(CLOUD_CANVASES_PREFIX).toBe('open_pencil_storage/canvases/')
  })

  test('builds canvas object keys under the namespace only', () => {
    const id = 'abc-123'
    expect(canvasFigKey(id)).toBe('open_pencil_storage/canvases/abc-123.fig')
    expect(canvasMetaKey(id)).toBe('open_pencil_storage/canvases/abc-123.meta.json')
    expect(canvasThumbKey(id)).toBe('open_pencil_storage/canvases/abc-123.thumb.jpg')
  })

  test('parses canvas id from fig keys and ignores foreign keys', () => {
    expect(canvasIdFromFigKey('open_pencil_storage/canvases/uuid-1.fig')).toBe('uuid-1')
    expect(canvasIdFromFigKey('other_prefix/canvases/uuid-1.fig')).toBeNull()
    expect(canvasIdFromFigKey('open_pencil_storage/canvases/nested/uuid-1.fig')).toBeNull()
    expect(canvasIdFromFigKey('open_pencil_storage/canvases/uuid-1.meta.json')).toBeNull()
  })
})
