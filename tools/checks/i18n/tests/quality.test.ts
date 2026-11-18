import { describe, expect, test } from 'bun:test'

import {
  hasMixedLatinAndCjk,
  hasShortcutText,
  placeholders,
  visibleTranslationText
} from '../src/quality'

describe('translation quality checks', () => {
  test('extracts and removes interpolation placeholders', () => {
    expect(placeholders('移除图片 {name}，尺寸 {width} × {height}')).toEqual([
      'height',
      'name',
      'width'
    ])
    expect(visibleTranslationText('画像 {name} を削除')).toBe('画像  を削除')
  })

  test('does not treat placeholder identifiers as translated Latin text', () => {
    expect(hasMixedLatinAndCjk('画像 {name} を削除')).toBe(false)
    expect(hasMixedLatinAndCjk('查看附件 {name}')).toBe(false)
  })

  test('still detects visible Latin text mixed with CJK text', () => {
    expect(hasMixedLatinAndCjk('画像 OpenPencil を表示')).toBe(true)
    expect(hasMixedLatinAndCjk('APIキーを更新')).toBe(true)
    expect(hasMixedLatinAndCjk('画像を表示')).toBe(false)
  })

  test('finds shortcuts spelled out in a message', () => {
    expect(hasShortcutText('Agent lenken … Alt+Enter wartet')).toBe(true)
    expect(hasShortcutText('Speichern mit Strg + S')).toBe(true)
    expect(hasShortcutText('Press ⌘K to search')).toBe(true)
    expect(hasShortcutText('Send with ctrl+enter')).toBe(true)
    expect(hasShortcutText('Save with MOD+S')).toBe(true)
    expect(hasShortcutText('Queue with Alt+{shortcut}')).toBe(true)
    expect(hasShortcutText('Steer the agent… {shortcut} waits until it is done')).toBe(false)
    expect(hasShortcutText('Enter a valid HTTP or HTTPS URL')).toBe(false)
    expect(hasShortcutText('Shift the layer by 10')).toBe(false)
  })
})
