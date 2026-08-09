import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

describe('text rendering invalidation keys', () => {
  test('TEXT_PICTURE_KEYS contains rendered-picture properties', () => {
    const keys = SceneGraph.TEXT_PICTURE_KEYS
    for (const k of [
      'text',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'italic',
      'textAlignHorizontal',
      'textDirection',
      'textAlignVertical',
      'lineHeight',
      'letterSpacing',
      'textDecoration',
      'textCase',
      'styleRuns',
      'fills',
      'width',
      'height'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  test('GLYPH_AFFECTING_KEYS contains only properties that change imported glyphs', () => {
    const keys = SceneGraph.GLYPH_AFFECTING_KEYS
    for (const k of [
      'text',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'italic',
      'textDirection',
      'lineHeight',
      'letterSpacing',
      'textCase',
      'styleRuns'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
    for (const k of [
      'x',
      'y',
      'width',
      'height',
      'fills',
      'textAlignHorizontal',
      'textAlignVertical',
      'textDecoration'
    ]) {
      expect(keys.has(k)).toBe(false)
    }
  })

  test('TEXT_PICTURE_KEYS does NOT contain non-text properties', () => {
    const keys = SceneGraph.TEXT_PICTURE_KEYS
    for (const k of ['x', 'y', 'rotation', 'opacity', 'visible', 'name']) {
      expect(keys.has(k)).toBe(false)
    }
  })
})
