import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { FontFallbackScript } from '@open-pencil/core/text'
import { fontManager } from '@open-pencil/core/text'
import { collectTextNeededFallbackScripts } from '@open-pencil/core/text/coverage'

import { repoPath } from '#tests/helpers/paths'

let originalEnsureFallbackPack: typeof fontManager.ensureFallbackPack
let originalEnsureCJKFallback: typeof fontManager.ensureCJKFallback
let originalEnsureArabicFallback: typeof fontManager.ensureArabicFallback

async function interData() {
  return Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
}

const manager = fontManager as typeof fontManager & {
  cjkFallbackFamilies: Map<string, string[]>
  cjkFallbackPromises: Map<string, Promise<string[]>>
  arabicFallbackFamilies: string[]
  arabicFallbackPromise: Promise<string[]> | null
}

describe('CJK fallback loading and readiness', () => {
  beforeEach(() => {
    originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    originalEnsureCJKFallback = fontManager.ensureCJKFallback.bind(fontManager)
    originalEnsureArabicFallback = fontManager.ensureArabicFallback.bind(fontManager)
  })

  afterEach(() => {
    fontManager.ensureFallbackPack = originalEnsureFallbackPack
    fontManager.ensureCJKFallback = originalEnsureCJKFallback
    fontManager.ensureArabicFallback = originalEnsureArabicFallback
  })

  test('CJK text node reports cjk-sc as needed fallback script', async () => {
    const data = await interData()
    fontManager.markLoaded('Inter', 'Regular', data)

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: '你好世界',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32
    })

    const scripts = collectTextNeededFallbackScripts(editor.graph, [text.id])
    expect(scripts).toContain('cjk-sc')
  })

  test('fallback pack returns correct families for cjk-sc script', async () => {
    manager.cjkFallbackFamilies.clear()
    manager.cjkFallbackPromises.clear()
    manager.arabicFallbackFamilies = []
    manager.arabicFallbackPromise = null

    fontManager.ensureFallbackPack = async () => ({
      'cjk-sc': ['Regression CJK Fallback'],
      arabic: []
    })

    try {
      const result = await fontManager.ensureFallbackPack(['cjk-sc'])
      expect(result['cjk-sc']).toEqual(['Regression CJK Fallback'])
    } finally {
      manager.cjkFallbackFamilies.clear()
      manager.cjkFallbackPromises.clear()
      manager.arabicFallbackFamilies = []
      manager.arabicFallbackPromise = null
    }
  })

  test('editor font loading requests cjk-sc fallback for CJK text', async () => {
    const data = await interData()
    const requests: FontFallbackScript[][] = []
    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      requests.push([...scripts])
      return { 'cjk-sc': ['Manual CJK Fallback'], arabic: [] }
    }

    const editor = createEditor({
      loadFont: async (family, style) => {
        if (family === 'Inter' && style === 'Regular') {
          fontManager.markLoaded(family, style, data)
          return data
        }
        return null
      }
    })

    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: '上班打卡App',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32
    })

    await editor.loadFontsForNodes([text.id])

    expect(requests).toEqual([['cjk-sc']])
  })
})
