import { beforeAll, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'

import { textNodeToOutlineLayout } from '#core/text/outlines'

const editor = createEditor()

beforeAll(async () => {
  const data = await Bun.file('packages/core/assets/InterVariable.ttf').arrayBuffer()
  await fontManager.markLoaded('Inter', 'Regular', data)
  await fontManager.markLoaded('Inter', 'Bold', data)
})

function text(props: Partial<SceneNode>): SceneNode {
  return editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Hello world',
    fontFamily: 'Inter',
    fontSize: 32,
    width: 1000,
    height: 100,
    ...props
  })
}

function lineCount(node: SceneNode): number {
  const layout = textNodeToOutlineLayout(node)
  if (!layout) throw new Error('No outline layout')
  return new Set(layout.glyphs.map((glyph) => glyph.y)).size
}

function oneLineWidth(props: Partial<SceneNode>): number {
  const layout = textNodeToOutlineLayout(text({ ...props, textAutoResize: 'WIDTH_AND_HEIGHT' }))
  if (!layout) throw new Error('No outline layout')
  return layout.width
}

describe('textNodeToOutlineLayout', () => {
  test('wraps text without style runs at its width', () => {
    expect(lineCount(text({ width: 100, textAutoResize: 'HEIGHT' }))).toBe(2)
  })

  test('wraps by the advances of the text face', () => {
    const regular = oneLineWidth({ fontWeight: 400 })
    const bold = oneLineWidth({ fontWeight: 700 })
    expect(bold).toBeGreaterThan(regular)
    const width = (regular + bold) / 2

    expect(lineCount(text({ fontWeight: 400, width, textAutoResize: 'HEIGHT' }))).toBe(1)
    expect(lineCount(text({ fontWeight: 700, width, textAutoResize: 'HEIGHT' }))).toBe(2)
  })

  test('wraps by letter spacing', () => {
    const width = oneLineWidth({}) + 4
    const letterSpacing = { value: 2, unit: 'PIXELS' as const }

    expect(lineCount(text({ width, textAutoResize: 'HEIGHT' }))).toBe(1)
    expect(lineCount(text({ width, letterSpacing, textAutoResize: 'HEIGHT' }))).toBe(2)
  })
})
