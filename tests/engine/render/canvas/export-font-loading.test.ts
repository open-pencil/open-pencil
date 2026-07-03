import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import type { FontFallbackScript } from '@open-pencil/core/text'
import { fontManager } from '@open-pencil/core/text'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { prepareForExport } from '#core/canvas/renderer/fonts'

import { repoPath } from '#tests/helpers/paths'

type FallbackTestFontManager = typeof fontManager & {
  cjkFallbackFamilies: Map<FontFallbackScript, string[]>
}

describe('export font loading', () => {
  test('prepareForExport requests script-specific CJK fallback packs after primary fonts load', async () => {
    const data = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const text = graph.createNode('TEXT', pageId, {
      text: '環境設定',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      width: 120,
      height: 24
    })
    const manager = fontManager as FallbackTestFontManager
    const originalFallbackFamilies = new Map(manager.cjkFallbackFamilies)
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    const originalLoadFont = fontManager.loadFont.bind(fontManager)
    const requests: FontFallbackScript[][] = []
    const renderer = {
      measureTextNode: () => ({ width: 120, height: 24 })
    } as SkiaRenderer

    try {
      manager.cjkFallbackFamilies = new Map()
      fontManager.loadFont = async (family: string, style = 'Regular') => {
        if (family === 'Inter' && style === 'Regular') {
          fontManager.markLoaded(family, style, data)
          return data
        }
        return null
      }
      fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
        requests.push([...scripts])
        return { 'cjk-tc': ['Manual Traditional CJK Fallback'] }
      }

      const restore = await prepareForExport(renderer, graph, pageId, [text.id])
      restore()

      expect(requests).toEqual([['cjk-tc']])
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
      fontManager.loadFont = originalLoadFont
      manager.cjkFallbackFamilies = originalFallbackFamilies
    }
  })
})
