import { describe, expect, test } from 'bun:test'

import { isNodeFontLoaded } from '#core/canvas/text'
import type { SceneNode } from '#core/scene-graph'
import { fontManager } from '#core/text/fonts'

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

  test('requires CJK fallback for decomposed Hangul jamo text', () => {
    const manager = fontManager as typeof fontManager & {
      cjkFallbackFamilies: string[]
    }
    const originalFallbacks = [...manager.cjkFallbackFamilies]
    const family = `DecomposedHangul_${Date.now()}`
    const node = {
      type: 'TEXT',
      text: '환경설정',
      fontFamily: family,
      fontWeight: 400,
      italic: false,
      styleRuns: []
    } as SceneNode

    try {
      manager.cjkFallbackFamilies = []
      fontManager.markLoaded(family, 'Regular', new ArrayBuffer(8))
      expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(false)

      fontManager.setCJKFallbackFamily('Noto Sans KR')
      expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(true)
    } finally {
      manager.cjkFallbackFamilies = originalFallbacks
    }
  })
})
