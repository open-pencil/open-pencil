import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, ReadOnlyDocumentError, type Editor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode, VariableFormulaNode, VariableValue } from '@open-pencil/scene-graph'
import { convertColor, fitsGamut, toExtendedSRGB } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { MAX_FORMULA_DEPTH } from '@open-pencil/scene-graph/variables'

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
    expect(fitsGamut(red ?? P3_RED)).toBe(true)
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

  test('converting loads and converts pages not opened yet, internal ones too', async () => {
    await initCodec()
    const source = new SceneGraph()
    source.documentColorSpace = 'display-p3'
    const paint = { type: 'SOLID' as const, color: BLUE, opacity: 1, visible: true }
    const internal = source.addPage('Internal')
    source.updateNode(internal.id, { internalOnly: true })
    source.createNode('RECTANGLE', internal.id, { name: 'Hidden', fills: [paint] })
    source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Later', fills: [paint] })
    const bytes = await exportFigFile(source)
    const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
    editor = createEditor({ graph })
    await editor.setDocumentColorSpace('srgb', 'convert')
    const blue = toExtendedSRGB(BLUE, 'display-p3')
    for (const name of ['Hidden', 'Later']) {
      const layer = [...graph.getAllNodes()].find((node) => node.name === name)
      expectColor(layer?.fills[0].color, blue)
    }
  })

  test('converting gives instances their converted colors once, still following the component', async () => {
    editor = createEditor()
    const pageId = editor.state.currentPageId
    const paint = (color: Color) => [{ type: 'SOLID' as const, color, opacity: 1, visible: true }]
    const component = editor.graph.createNode('COMPONENT', pageId, { width: 10, height: 10 })
    const dot = editor.graph.createNode('RECTANGLE', component.id, { fills: paint(BLUE) })
    const instance = editor.graph.createInstance(component.id, pageId)
    if (!instance) throw new Error('Expected an instance')
    const instanceDot = () => editor.graph.getChildren(instance.id)[0]
    await editor.setDocumentColorSpace('display-p3', 'convert')
    await Promise.resolve()
    const once = convertColor(BLUE, 'srgb', 'display-p3', 'map')
    expect(editor.graph.getNode(dot.id)?.fills[0].color).toEqual(once)
    expect(instanceDot().fills[0].color).toEqual(once)

    editor.graph.updateNode(dot.id, { fills: paint(P3_RED) })
    editor.graph.syncInstances(component.id)
    expect(instanceDot().fills[0].color).toEqual(P3_RED)
  })

  test("converting keeps a bound paint's own opacity, through undo and redo", async () => {
    editor = createEditor()
    editor.graph.documentColorSpace = 'display-p3'
    const collection = editor.graph.createCollection('Theme')
    const mode = collection.modes[0].modeId
    const accent = editor.graph.createVariable('Accent', 'COLOR', collection.id, BLUE)
    const layer = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      fills: [{ type: 'SOLID', color: BLUE, opacity: 0.5, visible: true }],
      boundVariables: { 'fills/0/color': accent.id }
    })
    const fill = () => editor.graph.getNode(layer.id)?.fills[0]
    expect(fill()?.opacity).toBe(0.5)

    await editor.setDocumentColorSpace('srgb', 'convert')
    expect(fill()?.opacity).toBe(0.5)
    expectColor(fill()?.color, toExtendedSRGB(BLUE, 'display-p3'))
    editor.undo.undo()
    expect(fill()?.opacity).toBe(0.5)
    expect(fill()?.color).toEqual(BLUE)
    editor.undo.redo()
    expect(fill()?.opacity).toBe(0.5)

    // A later edit to the variable still refreshes the paint, as it does without converting.
    editor.updateVariableValue(accent.id, mode, { r: 1, g: 0, b: 0, a: 0.8 })
    expect(fill()?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(fill()?.opacity).toBe(0.8)
  })

  test('a bound paint refreshed in another mode after converting follows undo and redo', async () => {
    editor = createEditor()
    editor.graph.documentColorSpace = 'display-p3'
    const collection = editor.graph.createCollection('Theme')
    const light = collection.modes[0].modeId
    const dark = editor.graph.createMode(collection.id, 'Dark')
    if (!dark) throw new Error('Expected the dark mode')
    const accent = editor.graph.createVariable('Accent', 'COLOR', collection.id, BLUE)
    const variable = editor.graph.variables.get(accent.id)
    if (!variable) throw new Error('Expected the variable')
    variable.valuesByMode = { [light]: BLUE, [dark]: P3_RED }
    const layer = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      fills: [{ type: 'SOLID', color: BLUE, opacity: 1, visible: true }],
      boundVariables: { 'fills/0/color': accent.id }
    })
    const fill = () => editor.graph.getNode(layer.id)?.fills[0]
    await editor.setDocumentColorSpace('srgb', 'convert')

    // The layer moves to the dark mode outside the undo history, as a collaborator's edit does.
    editor.updateNode(layer.id, { variableModes: { [collection.id]: dark } })
    const darkConverted = convertColor(P3_RED, 'display-p3', 'srgb', 'map')
    expectColor(fill()?.color, { ...darkConverted, a: 1 })

    editor.undo.undo()
    expect(fill()?.color).toEqual(P3_RED)
    editor.undo.redo()
    expectColor(fill()?.color, { ...darkConverted, a: 1 })
  })

  test('a color set back after converting stays through undo and redo', async () => {
    const { fill } = p3Document()
    await editor.setDocumentColorSpace('srgb', 'convert')
    const layerId = editor.graph.getChildren(editor.state.currentPageId)[0].id
    // A collaborator sets the converted color back to its old value, outside the undo history.
    const current = fill()
    if (!current) throw new Error('Expected the fill')
    editor.graph.updateNode(layerId, { fills: [{ ...current, color: { ...P3_RED } }] })
    editor.undo.undo()
    expect(fill()?.color).toEqual(P3_RED)
    editor.undo.redo()
    // Undo left it alone, so redo does too.
    expect(fill()?.color).toEqual(P3_RED)
  })

  test('a formula too deep to convert leaves the document as it was', async () => {
    const { fill, accent } = p3Document()
    const collection = editor.graph.createCollection('Deep')
    let formula: VariableFormulaNode = BLUE
    for (let depth = 0; depth <= MAX_FORMULA_DEPTH + 1; depth++) {
      formula = { operator: 'add', operands: [formula, BLUE] }
    }
    let number: VariableFormulaNode = 1
    for (let depth = 0; depth <= MAX_FORMULA_DEPTH + 1; depth++) {
      number = { operator: 'add', operands: [number, 1] }
    }
    // A color formula, and a number formula, as reconciling bindings walks every variable.
    for (const [name, type, value] of [
      ['Deep', 'COLOR', formula],
      ['Deep number', 'FLOAT', number]
    ] as const) {
      const variable = editor.graph.createVariable(name, type, collection.id, {
        expression: 'FORMULA',
        type,
        value
      } as VariableValue)
      expect(editor.setDocumentColorSpace('srgb', 'convert')).rejects.toThrow()
      await editor.setDocumentColorSpace('srgb', 'convert').catch(() => undefined)
      expect(editor.graph.documentColorSpace).toBe('display-p3')
      expect(fill()?.color).toEqual(P3_RED)
      expect(accent()).toEqual(P3_RED)
      editor.graph.variables.delete(variable.id)
    }
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

  test('undoing and redoing a conversion keep edits made since', async () => {
    const { fill } = p3Document()
    const pageId = editor.state.currentPageId
    const paint = { type: 'SOLID' as const, color: BLUE, opacity: 1, visible: true }
    const vector = editor.graph.createNode('VECTOR', pageId, {
      fills: [paint],
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
    const network = () => editor.graph.getNode(vector.id)?.vectorNetwork
    const fills = () => editor.graph.getNode(vector.id)?.fills ?? []
    await editor.setDocumentColorSpace('srgb', 'convert')
    const converted = structuredClone(fills()[0].color)

    // Edited outside the undo history, as a collaborator's change arrives.
    const moved = structuredClone(network())
    if (!moved) throw new Error('Expected the vector to keep its network')
    moved.vertices[1] = { x: 40, y: 0 }
    const GREEN = { r: 0, g: 1, b: 0, a: 1 }
    editor.graph.updateNode(vector.id, {
      vectorNetwork: moved,
      fills: [
        { ...paint, color: GREEN },
        { ...fills()[0], visible: false }
      ]
    })

    editor.undo.undo()
    expect(network()?.vertices[1]).toEqual({ x: 40, y: 0 })
    expectColor(network()?.regions[0].fills?.[0].color, BLUE)
    // The new first paint stays; the converted one that moved is left, not guessed at.
    expect(fills()[0].color).toEqual(GREEN)
    expect(fills()[1]).toMatchObject({ visible: false, color: converted })
    // The untouched layer goes back exactly.
    expect(fill()?.color).toEqual(P3_RED)

    editor.undo.redo()
    expect(network()?.vertices[1]).toEqual({ x: 40, y: 0 })
    expectColor(network()?.regions[0].fills?.[0].color, toExtendedSRGB(BLUE, 'display-p3'))
    expect(fills()[0].color).toEqual(GREEN)
  })

  test('undoing a conversion after the document was replaced changes only its own document', async () => {
    p3Document()
    const original = editor.graph
    const layer = original.getChildren(editor.state.currentPageId)[0]
    await editor.setDocumentColorSpace('srgb', 'convert')
    const replacement = new SceneGraph()
    replacement.documentColorSpace = 'srgb'
    editor.replaceGraph(replacement)
    editor.undo.undo()
    expect(replacement.documentColorSpace).toBe('srgb')
    expect(original.documentColorSpace).toBe('display-p3')
    expect(original.getNode(layer.id)?.fills[0].color).toEqual(P3_RED)
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
