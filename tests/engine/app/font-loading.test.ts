import { describe, expect, test } from 'bun:test'

import { fontManager, type FontFallbackScript } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { ensureGraphFonts } from '@/app/editor/fonts'

import { expectDefined } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

describe('app font loading', () => {
  test('ensureGraphFonts loads fallback packs when loaded primary font misses CJK glyphs', async () => {
    const interData = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    fontManager.markLoaded('Inter', 'Regular', interData)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: '你好世界',
      fontFamily: 'Inter',
      fontSize: 32,
      textPicture: new Uint8Array([1, 2, 3])
    })

    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    let requestedScripts: FontFallbackScript[] = []
    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      requestedScripts = [...scripts]
      return { cjk: ['Regression CJK Fallback'], arabic: [] }
    }

    try {
      const changed = await ensureGraphFonts(graph, [text.id])

      expect(changed).toBe(true)
      expect(requestedScripts).toEqual(['cjk-sc'])
      expect(expectDefined(graph.getNode(text.id), 'text node').textPicture).toBeNull()
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
    }
  })

  test('ensureGraphFonts invalidates text pictures when a missing face loads', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: 'Hello',
      fontFamily: 'EnsureLoadFace',
      fontSize: 24,
      textPicture: new Uint8Array([9, 9, 9])
    })

    const originalLoadFont = fontManager.loadFont.bind(fontManager)
    fontManager.loadFont = async (family, style) => {
      if (family === 'EnsureLoadFace') {
        const data = new ArrayBuffer(8)
        fontManager.markLoaded(family, style ?? 'Regular', data)
        return data
      }
      return originalLoadFont(family, style ?? 'Regular')
    }

    try {
      const changed = await ensureGraphFonts(graph, [page.id])
      expect(changed).toBe(true)
      expect(fontManager.isStyleLoaded('EnsureLoadFace', 'Regular')).toBe(true)
      expect(expectDefined(graph.getNode(text.id), 'text node').textPicture).toBeNull()
    } finally {
      fontManager.loadFont = originalLoadFont
    }
  })
})
