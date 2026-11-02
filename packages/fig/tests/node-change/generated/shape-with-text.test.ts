import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { normalizeFigFragment } from '#fig/document/fragment'
import { generationOverridesOf } from '#fig/node-change/generated/records'
import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createShapeWithText, shapeWithTextLabel } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { shapeWithTextLabelBox } from '@open-pencil/scene-graph/shape-with-text'
import { percentLength } from '@open-pencil/scene-graph/text'

const guid = (localID: number) => ({ sessionID: 0, localID })
const slot = (localID: number) => ({ guids: [{ sessionID: 40_000_000, localID }] })
const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y })
const solid = (color: Color, opacity = 1) => ({
  type: 'SOLID' as const,
  color,
  opacity,
  visible: true
})
const green = { r: 0.804, g: 0.957, b: 0.827, a: 1 }
const darkGreen = { r: 0.4, g: 0.835, b: 0.459, a: 1 }
const black = { r: 0, g: 0, b: 0, a: 1 }

/**
 * A diamond from a FigJam board, trimmed to the fields read here: the shape's paint and corners
 * sit on its generated background (slot 0), its text on its generated label (slot 1), and its
 * own record carries neither.
 */
const decision: NodeChange = {
  guid: guid(2),
  type: 'SHAPE_WITH_TEXT',
  name: 'Decision',
  size: { x: 232.111, y: 152.572 },
  transform: at(286.11, 177.54),
  shapeWithTextType: 'DIAMOND',
  shapeUserHeight: 152.572,
  nodeGenerationData: {
    overrides: [
      {
        guidPath: slot(0),
        fillPaints: [solid(green)],
        strokePaints: [solid(darkGreen)],
        strokeWeight: 4,
        strokeAlign: 'CENTER',
        strokeCap: 'ROUND',
        strokeJoin: 'MITER',
        cornerRadius: 6
      },
      {
        guidPath: slot(1),
        fontSize: 24,
        fontName: { family: 'Inter', style: 'Medium', postscript: 'Inter-Medium' },
        lineHeight: { value: 1.5, units: 'RAW' },
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'TOP',
        textData: { characters: 'Decision' },
        fillPaints: [solid(black, 0.8)]
      }
    ]
  },
  derivedImmutableFrameData: {
    overrides: [{ guidPath: slot(1), size: { x: 108.056, y: 36 }, transform: at(62.03, 58) }],
    version: 1
  }
} as NodeChange

function importShape(record: NodeChange): { graph: SceneGraph; shape: SceneNode } {
  const graph = materializeDocument(normalizeFigFragment([record])).graph
  const shape = graph.getChildren(graph.getPages()[0].id)[0]
  return { graph, shape }
}

describe('shapes with text', () => {
  test('import paints the shape from its background and builds its label', () => {
    const { graph, shape } = importShape(decision)
    expect(shape).toMatchObject({
      type: 'SHAPE_WITH_TEXT',
      shapeWithTextType: 'DIAMOND',
      cornerRadius: 6,
      layoutMode: 'VERTICAL',
      primaryAxisAlign: 'CENTER'
    })
    expect(shape.fills[0]?.color).toEqual(green)
    expect(shape.strokes[0]).toMatchObject({ color: darkGreen, weight: 4 })
    // Connectors keep clear of the stroke by its weight.
    expect(shape).toMatchObject({ strokeWeight: 4, strokeAlign: 'CENTER' })
    const label = expectDefined(shapeWithTextLabel(graph, shape))
    expect(label).toMatchObject({
      text: 'Decision',
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 24,
      lineHeight: percentLength(150),
      textAutoResize: 'HEIGHT'
    })
    expect(label.fills[0]).toMatchObject({ color: black })
    expect(label.fills[0]?.opacity).toBeCloseTo(0.8)
  })

  test("the label box matches where FigJam laid this diamond's label out", () => {
    const box = shapeWithTextLabelBox('DIAMOND', 232.111, 152.572)
    expect(box.x).toBeCloseTo(62.03, 1)
    expect(box.width).toBeCloseTo(108.06, 1)
  })

  test('export writes the paint on the background and the text on the label', () => {
    const { graph, shape } = importShape(decision)
    const [record] = sceneNodeToKiwi(shape, guid(1), 0, { value: 10 }, graph, [])
    expect(record).toMatchObject({
      type: 'SHAPE_WITH_TEXT',
      shapeWithTextType: 'DIAMOND',
      shapeUserHeight: 152.572
    })
    expect(record.fillPaints).toBeUndefined()
    expect(record.strokePaints).toBeUndefined()
    expect(record.stackMode).toBeUndefined()
    expect(record.textData).toBeUndefined()
    const overrides = generationOverridesOf(record)
    const background = expectDefined(overrides.get(0))
    expect(background.fillPaints?.[0]?.color).toEqual(green)
    expect(background.strokePaints?.[0]?.color).toEqual(darkGreen)
    expect(background).toMatchObject({ strokeWeight: 4, cornerRadius: 6 })
    expect(overrides.get(1)?.textData?.characters).toBe('Decision')
  })

  test('a new shape round-trips through its record', () => {
    const { graph } = importShape(decision)
    const page = graph.getPages()[0]
    const shape = createShapeWithText(
      graph,
      page.id,
      { shapeWithTextType: 'ENG_DATABASE', width: 160, height: 120, fills: [solid(green)] },
      { text: 'Orders' }
    )
    const [record] = sceneNodeToKiwi(shape, guid(1), 0, { value: 10 }, graph, [])
    const { graph: reread, shape: copy } = importShape({ ...record, guid: guid(5) })
    expect(copy).toMatchObject({ shapeWithTextType: 'ENG_DATABASE', cornerRadius: 6 })
    expect(copy.fills[0]?.color).toEqual(green)
    expect(shapeWithTextLabel(reread, copy)?.text).toBe('Orders')
  })

  test('a shape that keeps its height reopens truncating, its label without sizing fields', () => {
    const { graph } = importShape(decision)
    const page = graph.getPages()[0]
    const shape = createShapeWithText(
      graph,
      page.id,
      { width: 180, height: 120, shapeUserHeight: 120, shapeTruncates: true },
      { text: 'A label longer than the shape', textTruncation: 'ENDING', textAutoResize: 'NONE' }
    )
    const [record] = sceneNodeToKiwi(shape, guid(1), 0, { value: 10 }, graph, [])
    expect(record).toMatchObject({ shapeUserHeight: 120, shapeTruncates: true })
    const label = generationOverridesOf(record).get(1)
    expect([label?.textAutoResize, label?.textTruncation]).toEqual([undefined, undefined])
    const { shape: copy } = importShape({ ...record, guid: guid(6) })
    expect([copy.height, copy.shapeUserHeight, copy.shapeTruncates]).toEqual([120, 120, true])
  })

  test('a given height that is not a finite positive number is unset', () => {
    for (const shapeUserHeight of [Number.POSITIVE_INFINITY, Number.NaN, -4]) {
      const props = nodeChangeToProps({ ...decision, shapeUserHeight }, [])
      expect(props.shapeUserHeight).toBe(0)
    }
  })

  test('a shape with no generated layers gets an empty label to type into', () => {
    const { graph, shape } = importShape({ ...decision, nodeGenerationData: undefined })
    expect(shapeWithTextLabel(graph, shape)?.text).toBe('')
  })

  test('fall back to a square for a kind FigJam does not have', () => {
    const props = nodeChangeToProps(
      { type: 'SHAPE_WITH_TEXT', size: { x: 10, y: 10 }, shapeWithTextType: 'CLOUD' } as NodeChange,
      []
    )
    expect(props).toMatchObject({ shapeWithTextType: 'SQUARE' })
  })
})
