import { describe, expect, test } from 'bun:test'

import { isNodeFontLoaded } from '#core/canvas/text'
import { fontManager } from '#core/text/fonts'
import type { SceneNode } from '#core/scene-graph'

describe('canvas text font readiness', () => {
  test('requires the exact requested font weight before rendering text', () => {
    const family = `ExactWeight_${Date.now()}`
    const node = {
      type: 'TEXT',
      text: 'Bold title',
      fontFamily: family,
      fontWeight: 700,
      italic: false,
      styleRuns: []
    } as SceneNode

    fontManager.markLoaded(family, 'Regular', new ArrayBuffer(8))
    expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(false)

    fontManager.markLoaded(family, 'Bold', new ArrayBuffer(8))
    expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(true)
  })
})
