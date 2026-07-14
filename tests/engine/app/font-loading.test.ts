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
      return { 'cjk-sc': ['Regression CJK Fallback'], arabic: [] }
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

  test('ensureGraphFonts does not report changes when requested fallback pack is unavailable', async () => {
    const interData = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    fontManager.markLoaded('Inter', 'Regular', interData)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: '萬歲',
      fontFamily: 'Inter',
      fontSize: 32,
      textPicture: new Uint8Array([1, 2, 3])
    })

    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    fontManager.ensureFallbackPack = async () => ({ 'cjk-tc': [] })

    try {
      const changed = await ensureGraphFonts(graph, [text.id])

      expect(changed).toBe(false)
      expect(expectDefined(graph.getNode(text.id), 'text node').textPicture).toEqual(
        new Uint8Array([1, 2, 3])
      )
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
    }
  })

  test('ensureGraphFonts clears text pictures when primary font loads and fallback is unavailable', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: '萬歲',
      fontFamily: 'Fresh Primary Font',
      fontSize: 32,
      textPicture: new Uint8Array([1, 2, 3])
    })

    const originalLoadFont = fontManager.loadFont.bind(fontManager)
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    const originalHasFallbackForScript = fontManager.hasFallbackForScript.bind(fontManager)
    fontManager.loadFont = async (family: string) =>
      family === 'Fresh Primary Font' ? new ArrayBuffer(12) : null
    fontManager.ensureFallbackPack = async () => ({ 'cjk-tc': [] })
    fontManager.hasFallbackForScript = () => false

    try {
      const changed = await ensureGraphFonts(graph, [text.id])

      expect(changed).toBe(true)
      expect(expectDefined(graph.getNode(text.id), 'text node').textPicture).toBeNull()
    } finally {
      fontManager.loadFont = originalLoadFont
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
      fontManager.hasFallbackForScript = originalHasFallbackForScript
    }
  })

  test('ensureGraphFonts requests script-specific fallback despite generic CJK availability', async () => {
    const interData = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    fontManager.markLoaded('Inter', 'Regular', interData)

    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      text: '한글',
      fontFamily: 'Inter',
      fontSize: 32,
      textPicture: new Uint8Array([1, 2, 3])
    })

    type FontManagerFallbackInternals = {
      cjkFallbackFamilies: Map<FontFallbackScript, string[]>
      cjkFallbackPromises: Map<FontFallbackScript, Promise<string[]>>
    }
    const manager = fontManager as typeof fontManager & FontManagerFallbackInternals
    const originalFallbackFamilies = new Map(manager.cjkFallbackFamilies)
    const originalFallbackPromises = new Map(manager.cjkFallbackPromises)
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    let requestedScripts: FontFallbackScript[] = []

    manager.cjkFallbackFamilies = new Map()
    manager.cjkFallbackPromises = new Map()
    fontManager.setCJKFallbackFamily('Generic CJK')
    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      requestedScripts = [...scripts]
      return { 'cjk-kr': ['Noto Sans KR'] }
    }

    try {
      const changed = await ensureGraphFonts(graph, [text.id])

      expect(changed).toBe(true)
      expect(requestedScripts).toEqual(['cjk-kr'])
      expect(expectDefined(graph.getNode(text.id), 'text node').textPicture).toBeNull()
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
      manager.cjkFallbackFamilies = originalFallbackFamilies
      manager.cjkFallbackPromises = originalFallbackPromises
    }
  })
})
