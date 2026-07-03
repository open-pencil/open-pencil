import { describe, expect, test } from 'bun:test'

import {
  collectTextNeededFallbackScripts,
  fallbackScriptsForCharacter,
  fontManager,
  textNeededFallbackScripts
} from '@open-pencil/core/text'
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

  test('classifies individual characters for ordered fallback selection', () => {
    expect(fallbackScriptsForCharacter('體')).toEqual(['cjk-tc'])
    expect(fallbackScriptsForCharacter('あ')).toEqual(['cjk-jp'])
    expect(fallbackScriptsForCharacter('한')).toEqual(['cjk-kr'])
    expect(fallbackScriptsForCharacter('ش')).toEqual(['arabic'])
    expect(fallbackScriptsForCharacter('A')).toEqual([])
  })

  test('collects fallback scripts across nested graph nodes after primary fonts load', async () => {
    await loadInter()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { width: 400, height: 200 })
    graph.createNode('TEXT', frame.id, {
      text: '上班打卡App',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
    })
    graph.createNode('TEXT', frame.id, {
      text: '환경설정',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16
    })

    expect(collectTextNeededFallbackScripts(graph, [frame.id])).toEqual(['cjk-sc', 'cjk-kr'])
  })
})
