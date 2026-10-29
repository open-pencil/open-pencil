import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { collectionsBoundIn } from '@open-pencil/scene-graph/variables'
import { MIXED } from '@open-pencil/vue/controls/node-props'
import { setVariableMode, variableModeChoices } from '@open-pencil/vue/controls/variable-modes'

const RED = { r: 1, g: 0, b: 0, a: 1 }

function expectDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${label}`)
  return value
}

/**
 * A Theme collection with Light and Dark modes, a single-mode Density collection, a frame whose
 * fill is bound to Theme with a bound child inside it, and a plain frame.
 */
function setup() {
  const graph = new SceneGraph()
  const editor = createEditor({ graph })
  const page = expectDefined(graph.getPages()[0], 'first page').id
  const theme = graph.createCollection('Theme')
  const light = theme.defaultModeId
  theme.modes[0].name = 'Light'
  const dark = expectDefined(graph.createMode(theme.id, 'Dark'), 'Dark')
  const surface = graph.createVariable('Surface', 'COLOR', theme.id, RED)
  const density = graph.createCollection('Density')
  graph.createVariable('Gap', 'FLOAT', density.id, 8)
  const bound = { boundVariables: { 'fills/0/color': surface.id } }
  const outer = graph.createNode('FRAME', page, { name: 'Outer', ...bound })
  const inner = graph.createNode('FRAME', outer.id, { name: 'Inner', ...bound })
  const plain = graph.createNode('FRAME', page, { name: 'Plain' })
  const node = (id: string): SceneNode => expectDefined(graph.getNode(id), id)
  return { editor, graph, page, theme, light, dark, density, outer, inner, plain, node }
}

describe('variable mode choices', () => {
  test('offer the collections with more than one mode that the layers use', () => {
    const { editor, theme, outer, plain, node } = setup()
    expect(variableModeChoices(editor, [node(outer.id)]).map((c) => c.collectionId)).toEqual([
      theme.id
    ])
    expect(variableModeChoices(editor, [node(plain.id)])).toEqual([])
  })

  test('offer every collection with more than one mode for a page', () => {
    const { editor, theme, page, node } = setup()
    expect(variableModeChoices(editor, [node(page)]).map((c) => c.collectionId)).toEqual([theme.id])
  })

  test('show Auto with the inherited mode, the set mode, or MIXED', () => {
    const { editor, theme, light, dark, outer, inner, node } = setup()
    const [auto] = variableModeChoices(editor, [node(inner.id)])
    expect(auto?.value).toBeNull()
    expect(auto?.inherited).toEqual({ modeId: light, name: 'Light' })

    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    const [inherited] = variableModeChoices(editor, [node(inner.id)])
    expect(inherited?.inherited).toEqual({ modeId: dark, name: 'Dark' })
    expect(variableModeChoices(editor, [node(outer.id)])[0]?.value).toBe(dark)
    expect(variableModeChoices(editor, [node(outer.id), node(inner.id)])[0]?.value).toBe(MIXED)
  })
})

describe('setting a variable mode', () => {
  test('sets it on every target in one undo step, and the layers inside resolve it', () => {
    const { editor, graph, theme, dark, outer, inner, node } = setup()
    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    expect(node(outer.id).variableModes).toEqual({ [theme.id]: dark })
    expect(graph.getNodeVariableModeId(inner.id, theme.id)).toBe(dark)

    editor.undoAction()
    expect(node(outer.id).variableModes).toEqual({})
  })

  test('clearing it restores the inherited mode and keeps other collections', () => {
    const { editor, graph, theme, density, light, dark, outer, node } = setup()
    const densityMode = density.defaultModeId
    graph.updateNode(outer.id, { variableModes: { [density.id]: densityMode } })
    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    setVariableMode(editor, [node(outer.id)], theme.id, null)
    expect(node(outer.id).variableModes).toEqual({ [density.id]: densityMode })
    expect(graph.getNodeVariableModeId(outer.id, theme.id)).toBe(light)
  })
})

describe('collectionsBoundIn', () => {
  test('includes the collections that bound variables alias', () => {
    const { graph, theme, outer } = setup()
    const brand = graph.createCollection('Brand')
    const accent = graph.createVariable('Accent', 'COLOR', brand.id, RED)
    const surface = expectDefined(graph.variables.get(theme.variableIds[0] ?? ''), 'Surface')
    surface.valuesByMode[theme.defaultModeId] = { aliasId: accent.id }
    expect(collectionsBoundIn(graph, [outer.id])).toEqual(new Set([theme.id, brand.id]))
  })
})
