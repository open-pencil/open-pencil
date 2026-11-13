import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, defineTool } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import {
  MAX_FONT_SIZE,
  MAX_LAYOUT_LENGTH,
  MAX_LAYOUT_SPACING
} from '@open-pencil/scene-graph/layout'

const tool = defineTool({
  name: 'place_box',
  description: 'Places a box',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    kind: v.picklist(['FRAME', 'RECTANGLE']),
    width: v.pipe(v.number(), v.minValue(1))
  }),
  execute: (_figma, args) => args
})

function builtIn(name: string) {
  const def = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!def) throw new Error(`Missing tool ${name}`)
  return def
}

describe('tool arguments', () => {
  test('name the tool and list every problem with its argument', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(() => tool.execute(figma, { kind: 'CIRCLE', width: 0 })).toThrow(
      [
        'Invalid arguments for place_box:',
        '× Invalid type: Expected ("FRAME" | "RECTANGLE") but received "CIRCLE"',
        '  → at kind',
        '× Invalid value: Expected >=1 but received 0',
        '  → at width'
      ].join('\n')
    )
  })

  test('pass valid arguments through', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(tool.execute(figma, { kind: 'FRAME', width: 10 })).toEqual({ kind: 'FRAME', width: 10 })
  })

  test('reject arguments the tool does not take instead of dropping them', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(() => tool.execute(figma, { kind: 'FRAME', width: 10, height: 10 })).toThrow(
      'Invalid arguments for place_box'
    )

    // Mis-nested calls that once succeeded as no-ops.
    const rect = figma.createRectangle()
    expect(() =>
      builtIn('update_node').execute(figma, { id: rect.id, properties: { x: 0, y: 500 } })
    ).toThrow('Invalid arguments for update_node')
    expect(rect.y).toBe(0)
    const text = figma.createText()
    expect(() =>
      builtIn('set_font').execute(figma, { id: text.id, font: { family: 'Verdana' } })
    ).toThrow('Invalid arguments for set_font')
  })

  test('refuse a size, a gap, or a font size beyond what layout can use', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    expect(() =>
      builtIn('update_node').execute(figma, { id: frame.id, width: MAX_LAYOUT_LENGTH + 1 })
    ).toThrow(`Expected <=${MAX_LAYOUT_LENGTH}`)
    expect(() =>
      builtIn('set_layout').execute(figma, { id: frame.id, spacing: MAX_LAYOUT_SPACING + 1 })
    ).toThrow(`Expected <=${MAX_LAYOUT_SPACING}`)
    expect(() =>
      builtIn('set_font').execute(figma, { id: figma.createText().id, size: MAX_FONT_SIZE + 1 })
    ).toThrow(`Expected <=${MAX_FONT_SIZE}`)
  })

  test('accept a size, a gap, or a font size at the largest value layout can use', () => {
    expect(v.parse(builtIn('update_node').input, { id: 'x', width: MAX_LAYOUT_LENGTH })).toEqual({
      id: 'x',
      width: MAX_LAYOUT_LENGTH
    })
    expect(v.parse(builtIn('set_layout').input, { id: 'x', spacing: MAX_LAYOUT_SPACING })).toEqual({
      id: 'x',
      spacing: MAX_LAYOUT_SPACING
    })
    expect(v.parse(builtIn('set_font').input, { id: 'x', size: MAX_FONT_SIZE })).toEqual({
      id: 'x',
      size: MAX_FONT_SIZE
    })
  })

  test('refuse a size, a gap, or a font size below what layout can use', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    expect(() => builtIn('update_node').execute(figma, { id: frame.id, width: 0 })).toThrow(
      'Expected >=1'
    )
    expect(() => builtIn('set_layout').execute(figma, { id: frame.id, spacing: -1 })).toThrow(
      'Expected >=0'
    )
    expect(() =>
      builtIn('set_font').execute(figma, { id: figma.createText().id, size: 0 })
    ).toThrow('Expected >=1')
    expect(() => builtIn('set_layout_child').execute(figma, { id: frame.id, grow: -1 })).toThrow(
      'Expected >=0'
    )
  })

  test('accept a size, a gap, or a font size at the smallest value layout can use', () => {
    expect(v.parse(builtIn('update_node').input, { id: 'x', width: 1 })).toEqual({
      id: 'x',
      width: 1
    })
    expect(v.parse(builtIn('set_layout').input, { id: 'x', spacing: 0 })).toEqual({
      id: 'x',
      spacing: 0
    })
    expect(v.parse(builtIn('set_layout_child').input, { id: 'x', grow: 0 })).toEqual({
      id: 'x',
      grow: 0
    })
    expect(v.parse(builtIn('set_font').input, { id: 'x', size: 1 })).toEqual({ id: 'x', size: 1 })
  })

  test('read a numeric string as the number it names, within the bound', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    builtIn('update_node').execute(figma, { id: frame.id, width: '1000' })
    expect(figma.getNodeById(frame.id)?.width).toBe(1000)
  })
})
