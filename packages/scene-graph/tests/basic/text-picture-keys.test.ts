import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { GLYPH_AFFECTING_KEYS, TEXT_PICTURE_KEYS } from '@open-pencil/scene-graph/text/picture'

describe('text rendering invalidation keys', () => {
  test('TEXT_PICTURE_KEYS contains rendered-picture properties', () => {
    const keys = TEXT_PICTURE_KEYS
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
    const keys = GLYPH_AFFECTING_KEYS
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
      'fontVariations',
      'fontFeatures',
      'textAlignHorizontal',
      'textAlignVertical',
      'styleRuns'
    ]) {
      expect(keys.has(k)).toBe(true)
    }
    for (const k of ['x', 'y', 'width', 'height', 'fills', 'textDecoration']) {
      expect(keys.has(k)).toBe(false)
    }
  })

  test('TEXT_PICTURE_KEYS does NOT contain non-text properties', () => {
    const keys = TEXT_PICTURE_KEYS
    for (const k of ['x', 'y', 'rotation', 'opacity', 'visible', 'name']) {
      expect(keys.has(k)).toBe(false)
    }
  })
})

describe('document color profile and saved text pictures', () => {
  test('changing the profile drops every saved text picture', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, { text: 'Hi' })
    text.textPicture = new Uint8Array([1, 2, 3])
    graph.documentColorSpace = 'srgb'
    expect(text.textPicture).not.toBeNull()
    graph.documentColorSpace = 'display-p3'
    expect(text.textPicture).toBeNull()
  })
})
