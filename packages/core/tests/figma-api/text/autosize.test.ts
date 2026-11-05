import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import type { TextNode } from '@figma/plugin-typings/plugin-api-standalone'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'

// Recorded with the same script in live Figma on 2026-10-07, Inter Regular. Line metrics round
// differently by up to a pixel.

beforeAll(async () => {
  await fontManager.markLoaded(
    'Inter',
    'Regular',
    expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'bundled Inter font')
  )
})

function text() {
  const figma = new FigmaAPI(new SceneGraph())
  return figma.createText() as ReturnType<FigmaAPI['createText']> & TextNode
}

function size(node: { width: number; height: number }) {
  return [node.width, node.height]
}

describe('plugin text sizing', () => {
  test('new text is empty, 12px, and sizes itself to its content', () => {
    const node = text()
    expect(node.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(node.fontSize).toBe(12)
    expect(size(node)).toEqual([0, 15])

    node.characters = 'Hello'
    expect(size(node)).toEqual([29, 15])
    node.characters = 'Hello world, a longer line of text'
    expect(Math.abs(node.width - 180)).toBeLessThanOrEqual(1)
    node.characters = 'Hello'
    node.fontSize = 24
    expect(node.width).toBe(58)
    expect(Math.abs(node.height - 29)).toBeLessThanOrEqual(1)
  })

  test('resizing text fixes its size', () => {
    const node = text()
    // Read through a call, so the assignment below does not narrow what TypeScript expects.
    const mode = (): string => node.textAutoResize
    node.characters = 'Hello'
    node.resize(200, 50)
    expect(mode()).toBe('NONE')
    expect(size(node)).toEqual([200, 50])

    node.textAutoResize = 'HEIGHT'
    node.resize(100, 10)
    expect(mode()).toBe('NONE')
    node.characters = 'Hello there, this wraps across lines'
    expect(size(node)).toEqual([100, 10])
  })

  // Figma desktop 126 (2026-11-04): a line height of zero, or one under half a pixel as a
  // percent, sets the lines on top of each other, and the text is 0 px tall.
  test('a line height of zero makes text 0 px tall', () => {
    for (const lineHeight of [
      { unit: 'PIXELS', value: 0 },
      { unit: 'PERCENT', value: 0 },
      { unit: 'PERCENT', value: 2 }
    ] as const) {
      const node = text()
      node.fontSize = 14
      node.lineHeight = lineHeight
      node.characters = 'H\nH\nH'
      expect(node.height).toBe(0)
    }
  })

  test('a single line is its exact line height in pixels, rounded up', () => {
    for (const [fontSize, value, height] of [
      [9, 11.25, 12],
      [13, 16.25, 17],
      [16, 22.5, 23]
    ] as const) {
      const node = text()
      node.fontSize = fontSize
      node.lineHeight = { unit: 'PIXELS', value }
      node.characters = 'H'
      expect(node.height).toBe(height)
    }
  })
})
