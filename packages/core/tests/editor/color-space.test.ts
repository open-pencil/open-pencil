import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, ReadOnlyDocumentError, type Editor } from '@open-pencil/core'
import type { SceneNode, VariableValue } from '@open-pencil/scene-graph'
import { toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getPageBackgrounds, pageSourceWithBackgrounds } from '#core/figma-api/page-backgrounds'

let editor: Editor

afterEach(() => editor.dispose())

/** Display P3 red, outside sRGB. */
const P3_RED: Color = { r: 1, g: 0, b: 0, a: 1 }
/** A Display P3 blue inside sRGB too. */
const BLUE: Color = { r: 0.3, g: 0.5, b: 0.7, a: 1 }

/** A Display P3 document with a translucent red layer, a page color, and a color variable. */
function p3Document() {
  editor = createEditor()
  editor.graph.documentColorSpace = 'display-p3'
  const pageId = editor.state.currentPageId
  const layer = editor.graph.createNode('RECTANGLE', pageId, {
    fills: [{ type: 'SOLID', color: P3_RED, opacity: 0.5, visible: true }],
    strokes: [{ color: BLUE, weight: 1, type: 'SOLID', opacity: 1, visible: true, align: 'INSIDE' }]
  })
  editor.setPageColor(BLUE)
  const collection = editor.graph.createCollection('Theme')
  const variable = editor.graph.createVariable('Accent', 'COLOR', collection.id, P3_RED)
  const mode = collection.modes[0].modeId
  const fill = () => editor.graph.getNode(layer.id)?.fills[0]
  const stroke = () => editor.graph.getNode(layer.id)?.strokes[0].color
  const accent = () => editor.graph.variables.get(variable.id)?.valuesByMode[mode]
  return { fill, stroke, accent, page: () => editor.state.pageColor }
}

function expectColor(actual: unknown, expected: Color, precision = 4) {
  const color = actual as Color
  for (const channel of ['r', 'g', 'b', 'a'] as const) {
    expect(color[channel]).toBeCloseTo(expected[channel], precision)
  }
}

describe('document color profile', () => {
  test('assigning keeps every value and is one undo step', () => {
    const { fill, accent } = p3Document()
    editor.setDocumentColorSpace('srgb', 'assign')
    expect(editor.graph.documentColorSpace).toBe('srgb')
    expect(fill()?.color).toEqual(P3_RED)
    expect(accent()).toEqual(P3_RED)
    editor.undo.undo()
    expect(editor.graph.documentColorSpace).toBe('display-p3')
    editor.undo.redo()
    expect(editor.graph.documentColorSpace).toBe('srgb')
  })

  test('converting rewrites layers, pages, and variables from the current profile', async () => {
    const { fill, stroke, accent, page } = p3Document()
    await editor.setDocumentColorSpace('srgb', 'convert')

    // P3 red maps into sRGB as its nearest red, not read as if it were sRGB already.
    const red = fill()?.color
    expect(red?.r).toBeGreaterThan(0.95)
    expect(red?.g).toBeLessThan(0.2)
    expectColor(accent(), red ?? P3_RED)
    // The paint's own opacity is kept, not replaced with the color's alpha.
    expect(fill()?.opacity).toBe(0.5)
    // A color sRGB can show keeps its look: its new values are the same color in sRGB.
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    expectColor(stroke(), blue)
    expectColor(page(), blue)
  })

  test('converting covers gradient strokes and text decoration paints', async () => {
    editor = createEditor()
    editor.graph.documentColorSpace = 'display-p3'
    const pageId = editor.state.currentPageId
    const paint = { type: 'SOLID' as const, color: BLUE, opacity: 1, visible: true }
    const gradientStroke = {
      ...paint,
      type: 'GRADIENT_LINEAR' as const,
      gradientStops: [
        { color: BLUE, position: 0 },
        { color: P3_RED, position: 1 }
      ],
      weight: 2,
      align: 'CENTER' as const
    }
    const layer = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      strokes: [gradientStroke],
      textDecorationFills: [paint]
    })
    await editor.setDocumentColorSpace('srgb', 'convert')
    const node = editor.graph.getNode(layer.id)
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    expectColor(node?.strokes[0].gradientStops?.[0].color, blue)
    expect(node?.strokes[0].weight).toBe(2)
    expectColor(node?.textDecorationFills[0].color, blue)
  })

  test('converting covers a composed color variable and any page background', async () => {
    editor = createEditor()
    editor.graph.documentColorSpace = 'display-p3'
    const collection = editor.graph.createCollection('Theme')
    const mode = collection.modes[0].modeId
    const composed = editor.graph.createVariable('Tint', 'COLOR', collection.id, {
      expression: 'COMPOSE_COLOR',
      color: BLUE,
      opacity: 0.5
    })
    const page = editor.graph.getPages()[0]
    const solid = { type: 'SOLID' as const, color: BLUE, opacity: 1, visible: true }
    const gradient = {
      ...solid,
      type: 'GRADIENT_LINEAR' as const,
      gradientStops: [
        { color: BLUE, position: 0 },
        { color: BLUE, position: 1 }
      ]
    }
    // Two paints, one a gradient: more than the plugin API's page backgrounds take.
    editor.graph.updateNode(page.id, { source: pageSourceWithBackgrounds(page, [solid, gradient]) })
    const before = structuredClone(editor.graph.getNode(page.id)?.source)

    await editor.setDocumentColorSpace('srgb', 'convert')
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    const value = editor.graph.variables.get(composed.id)?.valuesByMode[mode]
    expect(value).toMatchObject({ expression: 'COMPOSE_COLOR', opacity: 0.5 })
    expectColor((value as { color: Color }).color, blue)
    const backgrounds = getPageBackgrounds(editor.graph.getNode(page.id) ?? page)
    expectColor(backgrounds[0].color, blue)
    expectColor(backgrounds[1].gradientStops?.[1].color, blue)

    editor.undo.undo()
    expect(editor.graph.getNode(page.id)?.source).toEqual(before)
  })

  test('converting covers layout grids, duotone noise, formulas, and vector regions', async () => {
    editor = createEditor()
    editor.graph.documentColorSpace = 'display-p3'
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      layoutGrids: [
        { pattern: 'GRID', sectionSize: 8, visible: true, color: BLUE }
      ] as SceneNode['layoutGrids'],
      effects: [
        {
          type: 'NOISE',
          color: BLUE,
          offset: { x: 0, y: 0 },
          radius: 0,
          spread: 0,
          visible: true,
          noise: {
            noiseType: 'DUOTONE',
            noiseSize: { x: 2, y: 2 },
            density: 0.5,
            secondaryColor: BLUE
          }
        }
      ]
    })
    const paint = { type: 'SOLID' as const, color: BLUE, opacity: 1, visible: true }
    const collection = editor.graph.createCollection('Theme')
    const mode = collection.modes[0].modeId
    const formula = editor.graph.createVariable('Mixed', 'COLOR', collection.id, {
      expression: 'FORMULA',
      type: 'COLOR',
      value: { operator: 'add', operands: [{ aliasId: 'accent' }, BLUE] }
    } as VariableValue)
    const vector = editor.graph.createNode('VECTOR', pageId, {
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
          { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]], fills: [paint] }]
      }
    })
    await editor.setDocumentColorSpace('srgb', 'convert')
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    expectColor(editor.graph.getNode(vector.id)?.vectorNetwork?.regions[0].fills?.[0].color, blue)
    const node = editor.graph.getNode(frame.id)
    expectColor(node?.layoutGrids[0].color, blue)
    expectColor(node?.effects[0].noise?.secondaryColor, blue)
    const value = editor.graph.variables.get(formula.id)?.valuesByMode[mode]
    const operation =
      typeof value === 'object' && 'expression' in value && value.expression === 'FORMULA'
        ? value.value
        : null
    if (typeof operation !== 'object' || !operation || !('operands' in operation)) {
      throw new Error('Expected the formula to keep its operation')
    }
    // An alias operand is left as it is; only literal colors convert.
    expect(operation.operands[0]).toEqual({ aliasId: 'accent' })
    expectColor(operation.operands[1], blue)
  })

  test('a document made read-only while its pages load is not converted', async () => {
    const { fill } = p3Document()
    const converting = editor.setDocumentColorSpace('srgb', 'convert')
    editor.setReadOnly(true)
    expect(converting).rejects.toBeInstanceOf(ReadOnlyDocumentError)
    await converting.catch(() => undefined)
    expect(editor.graph.documentColorSpace).toBe('display-p3')
    expect(fill()?.color).toEqual(P3_RED)
  })

  test('undoing a conversion puts back every value and the profile in one step', async () => {
    const { fill, stroke, accent, page } = p3Document()
    const before = { stroke: stroke(), page: page() }
    await editor.setDocumentColorSpace('srgb', 'convert')
    editor.undo.undo()
    expect(editor.graph.documentColorSpace).toBe('display-p3')
    expect(fill()?.color).toEqual(P3_RED)
    expect(accent()).toEqual(P3_RED)
    expect(stroke()).toEqual(before.stroke)
    expectColor(page(), before.page)
  })
})
