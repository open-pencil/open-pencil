import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import {
  copiesComponentPaints,
  reconcileVariableBindings
} from '@open-pencil/scene-graph/variables'

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const HALF_BLUE: Color = { r: 0, g: 0, b: 1, a: 0.5 }
const GREEN: Color = { r: 0, g: 1, b: 0, a: 1 }

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity, visible: true, blendMode: 'NORMAL' }
}

/** A Light and Dark theme, a tone bound to a rectangle's fill inside a frame, and an alias. */
function theme() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Theme')
  const light = collection.defaultModeId
  const dark = graph.createMode(collection.id, 'Dark') ?? ''
  const tone = graph.createVariable('Tone', 'COLOR', collection.id, RED)
  tone.valuesByMode[dark] = HALF_BLUE
  const other = graph.createVariable('Other', 'COLOR', collection.id, GREEN)
  const alias = graph.createVariable('Alias', 'COLOR', collection.id, { aliasId: tone.id })
  const frame = graph.createNode('FRAME', page)
  const rect = graph.createNode('RECTANGLE', frame.id, { fills: [solid(GREEN, 0.4)] })
  graph.bindVariable(rect.id, 'fills/0/color', tone.id)
  const setValue = (id: string, modeId: string, color: Color) => {
    const variable = graph.variables.get(id)
    if (!variable) throw new Error('variable')
    variable.valuesByMode[modeId] = color
    reconcileVariableBindings(graph, { variables: [id] })
  }
  const setMode = (nodeId: string, modeId: string | null) => {
    graph.updateNode(nodeId, { variableModes: modeId ? { [collection.id]: modeId } : {} })
    reconcileVariableBindings(graph, { subtrees: [nodeId] })
  }
  const edit = (opacity: number) =>
    graph.updateNode(rect.id, { fills: [{ ...rect.fills[0], opacity }] })
  const read = () => ({ ...rect.fills[0].color, a: rect.fills[0].opacity })
  return {
    graph,
    page,
    collection,
    light,
    dark,
    tone,
    other,
    alias,
    frame,
    rect,
    setValue,
    setMode,
    edit,
    read
  }
}

// Figma desktop 126, bound paints read through the Plugin API and exported as pixels: a bound
// paint's color and opacity are a cache Figma stores and draws, refreshed only when the color its
// variable gives the layer changes.
describe('bound paints', () => {
  test('binding writes the variable color into the paint, its alpha as opacity', () => {
    const { read } = theme()
    expect(read()).toEqual(RED)
  })

  test('an edited paint keeps its edit while the binding stays', () => {
    const { rect, edit, read } = theme()
    edit(0.5)
    expect(read()).toEqual({ ...RED, a: 0.5 })
    expect(rect.boundVariables['fills/0/color']).toBeDefined()
  })

  test('the same value set again keeps the edit', () => {
    const { tone, light, setValue, edit, read } = theme()
    edit(0.5)
    setValue(tone.id, light, RED)
    expect(read()).toEqual({ ...RED, a: 0.5 })
  })

  test('a new value in the layer mode refreshes the paint, discarding the edit', () => {
    const { tone, light, setValue, edit, read } = theme()
    edit(0.5)
    setValue(tone.id, light, GREEN)
    expect(read()).toEqual(GREEN)
  })

  test('a value changed in another mode or of another variable keeps the edit', () => {
    const { tone, other, light, dark, setValue, edit, read } = theme()
    edit(0.5)
    setValue(tone.id, dark, GREEN)
    setValue(other.id, light, RED)
    expect(read()).toEqual({ ...RED, a: 0.5 })
  })

  test('a paint bound through an alias refreshes when the alias target changes', () => {
    const { graph, rect, tone, alias, light, setValue, edit, read } = theme()
    graph.bindVariable(rect.id, 'fills/0/color', alias.id)
    edit(0.7)
    setValue(tone.id, light, GREEN)
    expect(read()).toEqual(GREEN)
  })

  test('a mode set or cleared on an ancestor refreshes the paint; the same mode again does not', () => {
    const { frame, light, dark, setMode, edit, read } = theme()
    edit(0.7)
    setMode(frame.id, dark)
    expect(read()).toEqual(HALF_BLUE)
    edit(0.7)
    setMode(frame.id, dark)
    expect(read()).toEqual({ ...HALF_BLUE, a: 0.7 })
    setMode(frame.id, null)
    expect(read()).toEqual(RED)
    // Setting the mode the layer already shows still refreshes it, as in Figma: what decides is
    // the mode set for the layer, not the color it gives (scratch/pr-oracle/1879 rule-probe).
    edit(0.7)
    setMode(frame.id, light)
    expect(read()).toEqual(RED)
  })

  test('moving into a frame in another mode refreshes the paint', () => {
    const { graph, page, collection, rect, dark, edit, read } = theme()
    const darkFrame = graph.createNode('FRAME', page, { variableModes: { [collection.id]: dark } })
    edit(0.7)
    graph.reparentNode(rect.id, darkFrame.id)
    expect(read()).toEqual(HALF_BLUE)
  })

  test('moving between frames in the same modes keeps the edit', () => {
    const { graph, page, rect, edit, read } = theme()
    const plain = graph.createNode('FRAME', page)
    edit(0.7)
    graph.insertChildAt(rect.id, plain.id, 0)
    expect(read()).toEqual({ ...RED, a: 0.7 })
  })

  test('a paint written on a layer with no applied color keeps the write until the color changes', () => {
    const { graph, tone, dark, light, setValue } = theme()
    // A loaded layer has no applied color; writing its paint records the one its variable gives.
    const loaded = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      fills: [solid(RED, 0.3)],
      boundVariables: { 'fills/0/color': tone.id }
    })
    const read = () => ({ ...loaded.fills[0].color, a: loaded.fills[0].opacity })
    graph.updateNode(loaded.id, { fills: [solid(RED, 0.3)] })
    setValue(tone.id, dark, GREEN)
    expect(read()).toEqual({ ...RED, a: 0.3 })
    setValue(tone.id, light, GREEN)
    expect(read()).toEqual(GREEN)
  })

  test('a copy keeps an edited paint until its color changes, and shows it in its own modes', () => {
    const { graph, page, collection, frame, rect, tone, light, dark, setValue, edit } = theme()
    edit(0.4)
    const copy = graph.cloneTree(rect.id, frame.id)
    if (!copy) throw new Error('copy')
    const read = (node = copy) => ({ ...node.fills[0].color, a: node.fills[0].opacity })
    // A reconcile reaching the copy while its variable's color is unchanged leaves the edit.
    reconcileVariableBindings(graph, { subtrees: [frame.id] })
    expect(read()).toEqual({ ...RED, a: 0.4 })
    setValue(tone.id, light, GREEN)
    expect(read()).toEqual(GREEN)

    edit(0.4)
    const darkFrame = graph.createNode('FRAME', page, { variableModes: { [collection.id]: dark } })
    const placed = graph.cloneTree(rect.id, darkFrame.id)
    if (!placed) throw new Error('placed')
    expect(read(placed)).toEqual(HALF_BLUE)
  })

  test('the check for paints a copy follows stops on a parent cycle', () => {
    const graph = new SceneGraph()
    const first = graph.createNode('FRAME', graph.getPages()[0].id)
    const second = graph.createNode('FRAME', first.id)
    graph.updateNode(first.id, { parentId: second.id })
    expect(copiesComponentPaints(graph, second, 'fills')).toBe(false)
  })
})
