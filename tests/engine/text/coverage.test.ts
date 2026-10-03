import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import {
  collectGraphFontRequirements,
  fontManager,
  textNeededFallbackScripts
} from '@open-pencil/core/text'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('font fallback coverage indexing', () => {
  test('collects glyphs after applying visual text case', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), { text: 'abc', textCase: 'UPPER' })
    expect(collectGraphFontRequirements(graph, [node.id]).characters).toBe('ABC')
  })

  test('detects supplementary-plane Han code points', async () => {
    const family = `SupplementaryHan_${Date.now()}`
    const data = await Bun.file('packages/core/assets/Inter-Regular.ttf').arrayBuffer()
    fontManager.markLoaded(family, 'Regular', data)
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      text: 'A𠀀B',
      fontFamily: family,
      fontWeight: 400
    })

    expect(textNeededFallbackScripts(node)).toContain('cjk-sc')
  })

  test('uses BCP-47 language hints for Han fallback selection', async () => {
    const family = `LanguageHint_${Date.now()}`
    const data = await Bun.file('packages/core/assets/Inter-Regular.ttf').arrayBuffer()
    fontManager.markLoaded(family, 'Regular', data)
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      text: '骨骨',
      textLanguage: 'ja-JP',
      fontFamily: family,
      fontWeight: 400,
      styleRuns: [
        {
          start: 1,
          length: 1,
          style: { textLanguage: 'zh-Hant-TW' }
        }
      ]
    })

    expect(textNeededFallbackScripts(node)).toEqual(['cjk-jp', 'cjk-tc'])
  })

  test('uses UTF-16 style-run indices after a surrogate pair', async () => {
    const cjkData = await Bun.file('tests/fixtures/fonts/NotoSansSC-Regular.ttf').arrayBuffer()
    const latinData = await Bun.file('packages/core/assets/Inter-Regular.ttf').arrayBuffer()
    const cjkFamily = `CJKRunBase_${Date.now()}`
    const latinFamily = `CJKRunOverride_${Date.now()}`
    fontManager.markLoaded(cjkFamily, 'Regular', cjkData)
    fontManager.markLoaded(latinFamily, 'Regular', latinData)
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      text: '😀你',
      fontFamily: cjkFamily,
      fontWeight: 400,
      styleRuns: [
        {
          start: 2,
          length: 1,
          style: { fontFamily: latinFamily }
        }
      ]
    })

    expect(textNeededFallbackScripts(node)).toContain('cjk-sc')
  })
})
