import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { FontFallbackScript } from '@open-pencil/core/text'
import { fontManager } from '@open-pencil/core/text'

import { repoPath } from '#tests/helpers/paths'

let originalEnsureFallbackPack: typeof fontManager.ensureFallbackPack

async function interData() {
  return Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
}

function installFallbackRecorder(requests: FontFallbackScript[][]) {
  fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
    requests.push([...scripts])
    return { 'cjk-sc': ['Manual CJK Fallback'] }
  }
}

describe('editor font loading', () => {
  beforeEach(() => {
    originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
  })

  afterEach(() => {
    fontManager.ensureFallbackPack = originalEnsureFallbackPack
  })

  test('clipboard font loading requests script-specific CJK fallback packs', async () => {
    const data = await interData()
    const requests: FontFallbackScript[][] = []
    installFallbackRecorder(requests)
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
      fontSize: 16
    })

    await editor.loadFontsForNodes([text.id])

    expect(requests).toEqual([['cjk-sc']])
  })

  test('page switching requests script-specific CJK fallback packs after lazy font loading', async () => {
    const data = await interData()
    const requests: FontFallbackScript[][] = []
    installFallbackRecorder(requests)
    const editor = createEditor({
      loadFont: async (family, style) => {
        if (family === 'Inter' && style === 'Regular') {
          fontManager.markLoaded(family, style, data)
          return data
        }
        return null
      }
    })
    const page = editor.graph.addPage('CJK page')
    editor.graph.createNode('TEXT', page.id, {
      text: '環境設定',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
    })

    await editor.switchPage(page.id)

    expect(requests).toEqual([['cjk-tc']])
  })
})
