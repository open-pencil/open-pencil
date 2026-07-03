import { describe, expect, test } from 'bun:test'

import { fontManager, textNeededFallbackScripts } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { repoPath } from '#tests/helpers/paths'

async function loadInter() {
  const interData = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
  fontManager.markLoaded('Inter', 'Regular', interData)
}

function textNode(text: string) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  return graph.createNode('TEXT', page.id, {
    text,
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 16
  })
}

describe('text fallback coverage', () => {
  test('selects simplified Chinese fallback script for missing ideographs', async () => {
    await loadInter()

    expect(textNeededFallbackScripts(textNode('你好'))).toEqual(['cjk-sc'])
  })

  test('selects traditional Chinese fallback script for traditional-only ideographs', async () => {
    await loadInter()

    expect(textNeededFallbackScripts(textNode('繁體'))).toEqual(['cjk-tc'])
  })

  test('selects Japanese fallback script for kana', async () => {
    await loadInter()

    expect(textNeededFallbackScripts(textNode('こんにちは'))).toEqual(['cjk-jp'])
  })

  test('selects Korean fallback script for Hangul', async () => {
    await loadInter()

    expect(textNeededFallbackScripts(textNode('환경설정'))).toEqual(['cjk-kr'])
  })
})
