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
  const italic = await Bun.file('packages/core/assets/InterVariable-Italic.ttf').arrayBuffer()
  await fontManager.markLoaded('Inter', 'Regular Italic', italic)
  await fontManager.markLoaded('Inter', 'Bold Italic', italic)
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
    const wrapped = text({ width: 100, textAutoResize: 'HEIGHT' })
    const unwrapped = text({ textAutoResize: 'WIDTH_AND_HEIGHT' })

    expect(lineCount(wrapped)).toBe(2)
    expect(textNodeToOutlineLayout(wrapped)?.glyphs).toHaveLength(
      textNodeToOutlineLayout(unwrapped)?.glyphs.length ?? -1
    )
  })

  test('keeps a kerned line that fits on one line', () => {
    const kerned = { text: 'AVAVAVAV' }
    const width = oneLineWidth(kerned)
    const unkerned = 'AVAVAVAV'.length * 0.5 * (oneLineWidth({ text: 'AA' }) + oneLineWidth({ text: 'VV' }))
    expect(unkerned).toBeGreaterThan(width)

    expect(lineCount(text({ ...kerned, width, textAutoResize: 'HEIGHT' }))).toBe(1)
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

  test('outlines italic text from the italic file', () => {
    const outline = (italic: boolean) =>
      textNodeToOutlineLayout(text({ text: 'l', italic, fontStyle: italic ? 'Italic' : 'Regular' }))
        ?.glyphs[0]?.commands
    const upright = outline(false)
    const slanted = outline(true)

    expect(upright).toBeDefined()
    expect(slanted).toBeDefined()
    expect(slanted).not.toEqual(upright)
  })

  test('wraps italic text by the advances of its weight', () => {
    const italic = { italic: true }
    const regular = oneLineWidth({ ...italic, fontWeight: 400, fontStyle: 'Italic' })
    const bold = oneLineWidth({ ...italic, fontWeight: 700, fontStyle: 'Bold Italic' })
    expect(bold).toBeGreaterThan(regular)
    const width = (regular + bold) / 2

    expect(
      lineCount(text({ ...italic, fontWeight: 400, fontStyle: 'Italic', width, textAutoResize: 'HEIGHT' }))
    ).toBe(1)
    expect(
      lineCount(
        text({ ...italic, fontWeight: 700, fontStyle: 'Bold Italic', width, textAutoResize: 'HEIGHT' })
      )
    ).toBe(2)
  })
})
