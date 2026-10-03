import { describe, expect, test } from 'bun:test'

import { rendererInvalidationForChanges } from '#core/editor/graph-events'

describe('graph event renderer invalidation', () => {
  test('committed updates always invalidate node pictures', () => {
    expect(rendererInvalidationForChanges({ x: 10 }, { preview: false })).toEqual({
      geometryCache: false,
      nodePicture: true
    })
  })

  test('geometry fields invalidate vector and geometry path caches', () => {
    for (const changes of [{ vectorNetwork: null }, { fillGeometry: [] }, { strokeGeometry: [] }]) {
      expect(rendererInvalidationForChanges(changes, { preview: false }).geometryCache).toBe(true)
      expect(rendererInvalidationForChanges(changes, { preview: true }).geometryCache).toBe(true)
    }
  })

  test('position-only preview updates keep node pictures', () => {
    expect(rendererInvalidationForChanges({ x: 10, y: 20 }, { preview: true })).toEqual({
      geometryCache: false,
      nodePicture: false
    })
  })

  test('size preview updates invalidate node pictures for effects and cached shapes', () => {
    expect(rendererInvalidationForChanges({ width: 20, height: 30 }, { preview: true })).toEqual({
      geometryCache: false,
      nodePicture: true
    })
  })
})
