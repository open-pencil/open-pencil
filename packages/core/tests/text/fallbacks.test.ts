import { describe, expect, test } from 'bun:test'

import {
  collectGraphFontRequirements,
  fontFallbackScriptForCharacter
} from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('fallback scripts', () => {
  test('cover every character of the scripts they draw', () => {
    // Hangul jamo, half-width katakana, and an Arabic letter from the Extended-B block.
    expect(['ᄀ', 'ｱ', 'ࡰ'].map((char) => fontFallbackScriptForCharacter(char))).toEqual([
      'cjk-kr',
      'cjk-jp',
      'arabic'
    ])
  })

  test('read 著 as Chinese, which Simplified writes too, not as Traditional only', () => {
    expect(fontFallbackScriptForCharacter('著')).toBe('cjk-sc')
  })

  test('read the characters OpenCC simplifies as Traditional only', () => {
    expect([...'語設國'].map((char) => fontFallbackScriptForCharacter(char))).toEqual([
      'cjk-tc',
      'cjk-tc',
      'cjk-tc'
    ])
    // Written alike in both: a hand-picked list once counted it Traditional.
    expect(fontFallbackScriptForCharacter('警')).toBe('cjk-sc')
  })

  test('read a language tag by the script its language is written in', () => {
    const scripts = ['zh', 'zh-TW', 'zh-Hans-HK', 'zh_HK', 'zh-Hani-TW', 'yue', 'ja', 'ko-KR', 'en', 'not a tag']
    expect(scripts.map((language) => fontFallbackScriptForCharacter('中', language))).toEqual([
      'cjk-sc',
      'cjk-tc',
      'cjk-sc',
      'cjk-tc',
      'cjk-tc',
      'cjk-tc',
      'cjk-jp',
      'cjk-kr',
      'cjk-sc',
      'cjk-sc'
    ])
  })

  test('are the ones a document loads fonts for', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: '萬',
      fontFamily: 'Inter'
    })
    // A Traditional-only character draws in the Traditional Chinese fallback, so that one loads.
    expect(collectGraphFontRequirements(graph, [text.id]).scripts).toEqual(['cjk-tc'])
  })

  test('read characters a run clears the language of without the text language', () => {
    const graph = new SceneGraph()
    const text = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: '中中',
      fontFamily: 'Inter',
      textLanguage: 'ja',
      styleRuns: [{ start: 1, length: 1, style: { textLanguage: null } }]
    })
    expect(collectGraphFontRequirements(graph, [text.id]).scripts.toSorted()).toEqual([
      'cjk-jp',
      'cjk-sc'
    ])
  })
})
