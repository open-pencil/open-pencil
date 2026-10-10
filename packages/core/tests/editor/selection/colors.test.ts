import { describe, expect, test } from 'bun:test'

import {
  createEditor,
  replaceSelectionColor,
  selectionColors,
  selectionColorsShown
} from '@open-pencil/core/editor'
import type { Color, Fill } from '@open-pencil/scene-graph'

const RED = { r: 1, g: 0.3, b: 0.2, a: 1 }
const BLUE = { r: 0.2, g: 0.4, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }
const GREY = { r: 0.85, g: 0.85, b: 0.85, a: 1 }

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

// The layers Figma desktop 126 was probed with.
function setup() {
  const editor = createEditor()
  const { graph } = editor
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, { fills: [solid(BLUE)] })
  graph.createNode('RECTANGLE', frame.id, { fills: [solid(GREY)] })
  const rectA = graph.createNode('RECTANGLE', pageId, {
    fills: [solid(RED)],
    strokes: [{ ...solid(BLACK), weight: 2, align: 'INSIDE' }]
  })
  const rectB = graph.createNode('RECTANGLE', pageId, {
    fills: [solid(RED)],
    effects: [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true
      }
    ]
  })
  const ellipse = graph.createNode('ELLIPSE', pageId, { fills: [solid(BLUE)] })
  const text = graph.createNode('TEXT', pageId, { fills: [solid(BLACK)] })
  return { graph, frame: frame.id, rectA: rectA.id, rectB: rectB.id, ellipse: ellipse.id, text: text.id }
}

const hex = (color: Color) =>
  [color.r, color.g, color.b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

describe('selection colors', () => {
  // Figma desktop 126 lists text + rect A as 000000 then FF4D33: black fills the text and strokes
  // the rectangle, so it is used twice.
  test('lists fills and strokes, most used first', () => {
    const { graph, text, rectA } = setup()
    expect(selectionColors(graph, [text, rectA]).map((entry) => [hex(entry.color), entry.count])).toEqual([
      ['000000', 2],
      ['FF4D33', 1]
    ])
  })

  test('takes descendants and leaves out effect colours', () => {
    const { graph, frame, rectB } = setup()
    expect(selectionColors(graph, [frame, rectB]).map((entry) => hex(entry.color))).toEqual([
      '3366FF',
      'D9D9D9',
      'FF4D33'
    ])
  })

  test('replaces a colour on every layer that uses it, in one change per layer', () => {
    const { graph, frame, ellipse } = setup()
    const updates = replaceSelectionColor(
      graph,
      [frame, ellipse],
      { color: BLUE, opacity: 1 },
      { color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 0.5 }
    )
    expect(updates.map((update) => update.id)).toEqual([frame, ellipse])
    expect(updates[0]?.changes.fills?.[0]).toMatchObject({ color: { r: 0, g: 1, b: 0 }, opacity: 0.5 })
  })

  // Figma desktop 126 hides the list when the Fill and Stroke sections already show every colour.
  test('shows when fills differ or a layer has children', () => {
    const { graph, frame, rectA, rectB, ellipse } = setup()
    expect(selectionColorsShown(graph, [rectA])).toBe(false)
    expect(selectionColorsShown(graph, [rectA, rectB])).toBe(false)
    expect(selectionColorsShown(graph, [rectA, ellipse])).toBe(true)
    expect(selectionColorsShown(graph, [frame])).toBe(true)
  })
})
