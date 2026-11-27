import { describe, expect, test } from 'bun:test'

import { editingWorldFixture } from '#core-tests/editor/text/helpers'

import type { Fill } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import { expectDefined } from '@open-pencil/test-support/assert'

const BLACK: Fill = { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLUE = { r: 0, g: 0, b: 1, a: 1 }

const editingText = editingWorldFixture()

/** "Hello world" in black being edited with "world" selected, and a collection for variables. */
async function editingWorld() {
  const editing = await editingText({ fills: [BLACK] })
  return { ...editing, collection: editing.graph.createCollection('Tokens') }
}

describe('variables bound while text is edited', () => {
  test('a colour variable colours the selected characters only, and undoes', async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)

    editor.bindVariable(id, 'fills/0/color', brand.id)

    expect(node().fills).toEqual([BLACK])
    expect(node().boundVariables).toEqual({})
    expect(node().styleRuns).toEqual([
      {
        start: 6,
        length: 5,
        style: { fills: [{ ...BLACK, color: RED }], boundVariables: { 'fills/0/color': brand.id } }
      }
    ])
    expect(editor.getBoundVariable(id, 'fills/0/color')).toBe(brand.id)

    editor.undoAction()
    expect(node().styleRuns).toEqual([])
  })

  test('the selected characters follow their colour variable when its value changes', async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    editor.bindVariable(id, 'fills/0/color', brand.id)

    editor.updateVariableValue(brand.id, expectDefined(collection.modes[0], 'mode').modeId, BLUE)

    expect(node().styleRuns[0]?.style.fills?.[0]?.color).toEqual(BLUE)
    expect(node().fills).toEqual([BLACK])
  })

  test('unbinding the selection keeps its colour and leaves the layer as it was', async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    editor.bindVariable(id, 'fills/0/color', brand.id)

    editor.unbindVariable(id, 'fills/0/color')

    expect(node().styleRuns).toEqual([
      { start: 6, length: 5, style: { fills: [{ ...BLACK, color: RED }] } }
    ])
    expect(editor.getBoundVariable(id, 'fills/0/color')).toBeUndefined()
  })

  test('a number variable sizes the selected characters only', async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const size = graph.createVariable('Size', 'FLOAT', collection.id, 30)

    editor.bindVariable(id, 'fontSize', size.id)

    expect(node().boundVariables).toEqual({})
    expect(node().styleRuns).toEqual([
      { start: 6, length: 5, style: { fontSize: 30, boundVariables: { fontSize: size.id } } }
    ])
    expect(editor.getTextSelectionStyle(node())?.boundVariables).toEqual({ fontSize: size.id })
  })

  test("binding or unbinding a size keeps the characters' colour variable", async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    const size = graph.createVariable('Size', 'FLOAT', collection.id, 30)
    editor.bindVariable(id, 'fills/0/color', brand.id)

    editor.bindVariable(id, 'fontSize', size.id)
    expect(node().styleRuns[0]?.style.boundVariables).toEqual({
      'fills/0/color': brand.id,
      fontSize: size.id
    })

    editor.unbindVariable(id, 'fontSize')
    expect(node().styleRuns[0]?.style.boundVariables).toEqual({ 'fills/0/color': brand.id })
  })

  test('with nothing selected, a variable binds the layer', async () => {
    const { editor, graph, collection, id, node, state } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    state.selectionAnchor = null

    editor.bindVariable(id, 'fills/0/color', brand.id)

    expect(node().boundVariables).toEqual({ 'fills/0/color': brand.id })
    expect(node().styleRuns).toEqual([])
  })

  test("a fill list edited on the selection keeps its paints' bindings off the layer", async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    editor.bindVariable(id, 'fills/0/color', brand.id)
    const shown = { ...node(), ...editor.getTextSelectionStyle(node()) }

    // A paint added under the bound one, as the fill list writes it.
    editor.updateNodeWithUndo(
      id,
      {
        fills: [BLACK, ...shown.fills],
        boundVariables: { 'fills/1/color': brand.id }
      },
      'Add fills'
    )

    expect(node().boundVariables).toEqual({})
    expect(node().styleRuns[0]?.style.boundVariables).toEqual({ 'fills/1/color': brand.id })
  })
})

describe('bindings the panel shows and keeps for a selection', () => {
  test('a paragraph binding of the layer still shows over characters that bind their own', async () => {
    const { editor, graph, collection, id } = await editingWorld()
    const size = graph.createVariable('Size', 'FLOAT', collection.id, 12)
    const spacing = graph.createVariable('Spacing', 'FLOAT', collection.id, 8)
    // As a .fig file can hold them: the layer binds its paragraphs' spacing, and the selected
    // characters bind their size alone.
    graph.updateNode(id, {
      boundVariables: { paragraphSpacing: spacing.id },
      styleRuns: [
        { start: 6, length: 5, style: { fontSize: 12, boundVariables: { fontSize: size.id } } }
      ]
    })

    expect(editor.getBoundVariable(id, 'paragraphSpacing')).toBe(spacing.id)
    expect(editor.getBoundVariable(id, 'fontSize')).toBe(size.id)
  })

  test("a fill list edited on the selection keeps each character's own size binding", async () => {
    const { editor, graph, collection, id, node, state } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    const small = graph.createVariable('Small', 'FLOAT', collection.id, 12)
    const large = graph.createVariable('Large', 'FLOAT', collection.id, 30)
    state.selectionAnchor = 6
    state.cursor = 8
    editor.bindVariable(id, 'fontSize', small.id)
    state.selectionAnchor = 8
    state.cursor = 11
    editor.bindVariable(id, 'fontSize', large.id)
    state.selectionAnchor = 6

    editor.updateNodeWithUndo(
      id,
      { fills: [{ ...BLACK, color: RED }], boundVariables: { 'fills/0/color': brand.id } },
      'Change fills'
    )

    expect(node().styleRuns.map((run) => run.style.boundVariables)).toEqual([
      { fontSize: small.id, 'fills/0/color': brand.id },
      { fontSize: large.id, 'fills/0/color': brand.id }
    ])
  })

  test("unbinding characters that show the layer's bound fill keeps them off its variable", async () => {
    const { editor, graph, collection, id, node } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    graph.bindVariable(id, 'fills/0/color', brand.id)

    editor.unbindVariable(id, 'fills/0/color')
    editor.updateVariableValue(brand.id, expectDefined(collection.modes[0], 'mode').modeId, BLUE)

    expect(node().fills[0]?.color).toEqual(BLUE)
    // Binding gave the layer's fill the variable's red, which the characters keep.
    expect(node().styleRuns).toEqual([
      { start: 6, length: 5, style: { fills: [{ ...BLACK, color: RED }] } }
    ])
    expect(editor.getBoundVariable(id, 'fills/0/color')).toBeUndefined()
  })

  test('characters bound apart show each binding, so the panel can show them as mixed', async () => {
    const { editor, graph, collection, id, state } = await editingWorld()
    const brand = graph.createVariable('Brand', 'COLOR', collection.id, RED)
    state.selectionAnchor = 8
    editor.bindVariable(id, 'fills/0/color', brand.id)
    state.selectionAnchor = 6

    expect(editor.getBoundVariableIds(id, 'fills/0/color')).toEqual([undefined, brand.id])
  })
})

describe('styles applied while text is edited', () => {
  test('a text style styles the selected characters only, and detaches from them', async () => {
    const { editor, graph, id, node } = await editingWorld()
    const page = editor.state.currentPageId
    graph.createNodeWithId('style:heading', 'TEXT', page, {
      name: 'Heading',
      sharedStyleType: 'TEXT',
      internalOnly: true,
      fontSize: 32,
      source: { ...createDefaultSourceMetadata(), id: 'style:heading' }
    })

    editor.updateNodeWithUndo(id, { textStyleId: 'style:heading', fontSize: 32 }, 'Apply style')

    expect(node().textStyleId).toBeNull()
    expect(node().fontSize).not.toBe(32)
    expect(node().styleRuns[0]).toMatchObject({
      start: 6,
      length: 5,
      style: { textStyleId: 'style:heading', fontSize: 32 }
    })
    expect(editor.getTextSelectionStyle(node())?.textStyleId).toBe('style:heading')

    // Detached, the characters keep the style's values, as Figma leaves them.
    editor.updateNodeWithUndo(id, { textStyleId: null }, 'Detach style')
    expect(node().styleRuns).toEqual([{ start: 6, length: 5, style: { fontSize: 32 } }])
  })

  test('a colour style fills the selected characters only', async () => {
    const { editor, graph, id, node } = await editingWorld()
    const page = editor.state.currentPageId
    const red: Fill = { ...BLACK, color: RED }
    graph.createNodeWithId('style:brand', 'RECTANGLE', page, {
      name: 'Brand',
      sharedStyleType: 'FILL',
      internalOnly: true,
      fills: [red],
      source: { ...createDefaultSourceMetadata(), id: 'style:brand' }
    })

    editor.updateNodeWithUndo(id, { fillStyleId: 'style:brand', fills: [red] }, 'Apply style')

    expect(node().fillStyleId).toBeNull()
    expect(node().fills).toEqual([BLACK])
    expect(node().styleRuns).toEqual([
      { start: 6, length: 5, style: { fillStyleId: 'style:brand', fills: [red] } }
    ])
  })
})
