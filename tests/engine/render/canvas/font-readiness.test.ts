import { describe, expect, test } from 'bun:test'

import type { SceneNode } from '@open-pencil/scene-graph'

import { isNodeFontLoaded } from '#core/canvas/text'
import { fontManager } from '#core/text/fonts'

import { repoPath } from '#tests/helpers/paths'

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

  test('accepts loaded generic CJK fallbacks for render readiness without marking script packs loaded', async () => {
    const manager = fontManager as typeof fontManager & {
      cjkFallbackFamilies: Map<string, string[]>
    }
    const originalFallbacks = new Map(manager.cjkFallbackFamilies)
    const inter = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    const noto = await Bun.file(
      repoPath('tests/fixtures/fonts/NotoSansSC-Regular.ttf')
    ).arrayBuffer()
    const node = {
      type: 'TEXT',
      text: '你好',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      styleRuns: []
    } as SceneNode

    try {
      manager.cjkFallbackFamilies = new Map()
      fontManager.markLoaded('Inter', 'Regular', inter)
      fontManager.markLoaded('Noto Sans SC', 'Regular', noto)
      fontManager.setCJKFallbackFamily('Noto Sans SC')

      expect(fontManager.hasFallbackForScript('cjk-sc')).toBe(false)
      expect(fontManager.getFallbackFamiliesForScript('cjk-sc')).toEqual(['Noto Sans SC'])
      expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(true)
    } finally {
      manager.cjkFallbackFamilies = originalFallbacks
    }
  })

  test('rejects generic CJK fallbacks that do not cover the requested script glyphs', async () => {
    const manager = fontManager as typeof fontManager & {
      cjkFallbackFamilies: Map<string, string[]>
    }
    const originalFallbacks = new Map(manager.cjkFallbackFamilies)
    const inter = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    const noto = await Bun.file(
      repoPath('tests/fixtures/fonts/NotoSansSC-Regular.ttf')
    ).arrayBuffer()
    const node = {
      type: 'TEXT',
      text: '한글',
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      styleRuns: []
    } as SceneNode

    try {
      manager.cjkFallbackFamilies = new Map()
      fontManager.markLoaded('Inter', 'Regular', inter)
      fontManager.markLoaded('Noto Sans SC', 'Regular', noto)
      fontManager.setCJKFallbackFamily('Noto Sans SC')

      expect(fontManager.getFallbackFamiliesForScript('cjk-kr')).toEqual(['Noto Sans SC'])
      expect(fontManager.hasFallbackForScript('cjk-kr')).toBe(false)
      expect(isNodeFontLoaded({} as Parameters<typeof isNodeFontLoaded>[0], node)).toBe(false)
    } finally {
      manager.cjkFallbackFamilies = originalFallbacks
    }
  })
})
