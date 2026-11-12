import { expect, test } from 'bun:test'

import { SceneGraph, type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import type { Color } from '@open-pencil/scene-graph/primitives'

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }
const BLUE: Color = { r: 0, g: 0, b: 1, a: 1 }

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color: { ...color, a: 1 }, opacity, visible: true, blendMode: 'NORMAL' }
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${what}`)
  return value
}

/** A component whose shape's fill is bound to a tone, red in Light and blue in Dark. */
function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Theme')
  const dark = graph.createMode(collection.id, 'Dark') ?? ''
  const tone = graph.createVariable('Tone', 'COLOR', collection.id, RED)
  tone.valuesByMode[dark] = BLUE
  const component = graph.createNode('COMPONENT', page)
  const shape = graph.createNode('RECTANGLE', component.id, { fills: [solid(BLUE, 0.2)] })
  graph.bindVariable(shape.id, 'fills/0/color', tone.id)
  const holder = graph.createNode('FRAME', page, { variableModes: { [collection.id]: dark } })
  const copyOf = (instance: SceneNode) =>
    must(graph.getNode(must(instance.childIds[0], 'copy')), 'copy')
  const read = (node: SceneNode) => ({ ...node.fills[0].color, a: node.fills[0].opacity })
  const edit = (node: SceneNode, opacity: number) =>
    graph.updateNode(node.id, { fills: [{ ...node.fills[0], opacity }] })
  return { graph, page, component, shape, holder, copyOf, read, edit }
}

// Figma desktop 126: a copy's bound paint shows its variable in the copy's own context, and the
// component's edits to the paint's color or opacity never reach it, even in the same mode.
test("a component's edit to its bound paint does not reach its instances", () => {
  const { graph, page, component, shape, copyOf, read, edit } = setup()
  const instance = must(graph.createInstance(component.id, page), 'instance')
  edit(shape, 0.6)
  graph.syncInstances(component.id)
  expect(read(shape)).toEqual({ ...RED, a: 0.6 })
  expect(read(copyOf(instance))).toEqual(RED)
})

test("a new instance shows its variables in its own context, not its component's cache", () => {
  const { graph, component, shape, holder, copyOf, read, edit } = setup()
  edit(shape, 0.6)
  const instance = must(graph.createInstance(component.id, holder.id), 'instance')
  expect(read(copyOf(instance))).toEqual(BLUE)
})

test("an instance's own edit sticks through component edits until its variable's color changes", () => {
  const { graph, page, component, shape, holder, copyOf, read, edit } = setup()
  const instance = must(graph.createInstance(component.id, page), 'instance')
  edit(copyOf(instance), 0.3)
  recordInstanceOverride(graph, copyOf(instance).id, ['fills'])
  edit(shape, 0.5)
  graph.syncInstances(component.id)
  expect(read(copyOf(instance))).toEqual({ ...RED, a: 0.3 })
  graph.reparentNode(instance.id, holder.id)
  expect(read(copyOf(instance))).toEqual(BLUE)
})

test('a component paint rebound to another variable gives its copies that variable in their context', () => {
  const { graph, component, shape, holder, copyOf, read } = setup()
  const instance = must(graph.createInstance(component.id, holder.id), 'instance')
  const collectionId = must(
    graph.variables.get(shape.boundVariables['fills/0/color']),
    'tone'
  ).collectionId
  const accent = graph.createVariable('Accent', 'COLOR', collectionId, BLUE)
  const darkMode = must(holder.variableModes[collectionId], 'dark mode')
  accent.valuesByMode[darkMode] = { r: 0, g: 1, b: 0, a: 1 }
  graph.bindVariable(shape.id, 'fills/0/color', accent.id)
  graph.syncInstances(component.id)
  expect(read(copyOf(instance))).toEqual({ r: 0, g: 1, b: 0, a: 1 })
})
