import { describe, expect, test } from 'bun:test'

import {
  enforcedAspectRatio,
  recapturedAspectRatio,
  SceneGraph,
  sizeKeepingAspectRatio
} from '@open-pencil/scene-graph'

describe('aspect ratio lock', () => {
  test('a locked layer keeps the ratio of its stored size', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const rect = graph.createNode('RECTANGLE', page, { targetAspectRatio: { x: 32, y: 16 } })
    expect(enforcedAspectRatio(rect)).toBe(2)
    expect(sizeKeepingAspectRatio(2, 'width', 300)).toEqual({ width: 300, height: 150 })
    expect(sizeKeepingAspectRatio(2, 'height', 50)).toEqual({ width: 100, height: 50 })
  })

  test('free, degenerate, and auto-resizing text layers keep no ratio', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const free = graph.createNode('RECTANGLE', page)
    const flat = graph.createNode('LINE', page, { targetAspectRatio: { x: 100, y: 0 } })
    const text = graph.createNode('TEXT', page, {
      textAutoResize: 'WIDTH_AND_HEIGHT',
      targetAspectRatio: { x: 29, y: 15 }
    })
    expect(enforcedAspectRatio(free)).toBeNull()
    expect(enforcedAspectRatio(flat)).toBeNull()
    expect(enforcedAspectRatio(text)).toBeNull()
    expect(enforcedAspectRatio({ ...text, textAutoResize: 'NONE' })).toBeCloseTo(29 / 15)
  })

  test('a resize that ignores the lock stores the new size only on locked layers', () => {
    expect(recapturedAspectRatio({ targetAspectRatio: { x: 2, y: 1 } }, 300, 110)).toEqual({
      targetAspectRatio: { x: 300, y: 110 }
    })
    expect(recapturedAspectRatio({ targetAspectRatio: null }, 300, 110)).toEqual({})
  })
})
