import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  bindingOverrideField,
  hasInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'
import { bindVariable, unbindVariable } from '@open-pencil/scene-graph/variables'

import { observeWrites } from '../helpers/observe'

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id, { name: 'C' })
  const layer = graph.createNode('RECTANGLE', component.id, {
    name: 'Layer',
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  const instance = graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('No instance')
  const copy = graph.getChildren(instance.id)[0]
  const collection = graph.createCollection('Tokens')
  const number = graph.createVariable('n', 'FLOAT', collection.id, 0.5)
  const color = graph.createVariable('c', 'COLOR', collection.id, { r: 0, g: 0, b: 0, a: 1 })
  return { graph, layer, instance, copy, number, color }
}

describe('bindings inside an instance report the instance override writes', () => {
  test('bindVariable reports the instance before its overrides change', () => {
    const { graph, instance, copy, number } = setup()
    const claims = (state: SceneNode['instanceOverrides']) =>
      hasInstanceOverride(state, instance.id, copy.id, bindingOverrideField('opacity'))
    const seen = observeWrites(graph)
    bindVariable(graph, copy.id, 'opacity', number.id)
    seen.stop()

    const kept = seen.before.get(instance.id)
    expect(kept).toBeDefined()
    expect(kept && claims(kept.overrides)).toBe(false)
    expect(claims(instance.instanceOverrides)).toBe(true)
    expect(seen.touched.has(instance.id)).toBe(true)
  })

  test('unbindVariable reports the instance before its overrides change', () => {
    const { graph, instance, copy, number } = setup()
    bindVariable(graph, copy.id, 'opacity', number.id)
    const claims = (state: SceneNode['instanceOverrides']) =>
      hasInstanceOverride(state, instance.id, copy.id, bindingOverrideField('opacity'))
    const seen = observeWrites(graph)
    unbindVariable(graph, copy.id, 'opacity')
    seen.stop()

    const kept = seen.before.get(instance.id)
    expect(kept).toBeDefined()
    expect(kept && claims(kept.overrides)).toBe(true)
    expect(seen.touched.has(instance.id)).toBe(true)
  })
})

test('binding one paint colour reports the node before dropping its whole-list binding', () => {
  const { graph, layer, color } = setup()
  graph.updateNode(layer.id, { boundVariables: { fills: color.id } })
  const seen = observeWrites(graph)
  bindVariable(graph, layer.id, 'fills/0/color', color.id)
  seen.stop()

  expect(seen.before.get(layer.id)?.boundVariables).toEqual({ fills: color.id })
  expect(layer.boundVariables).toEqual({ 'fills/0/color': color.id })
  expect(seen.touched.has(layer.id)).toBe(true)
})

describe('bindings where the nearest and owning instances differ or coincide with the node', () => {
  const opacityClaim = bindingOverrideField('opacity')

  test('a layer in a nested instance reports both instances before their overrides change', () => {
    const { graph, layer, number } = setup()
    const page = graph.getPages()[0]
    const inner = graph.getNode(layer.parentId ?? '')
    if (!inner) throw new Error('No component')
    const outer = graph.createNode('COMPONENT', page.id, { name: 'Outer' })
    const nested = graph.createInstance(inner.id, outer.id)
    const instance = graph.createInstance(outer.id, page.id)
    if (!nested || !instance) throw new Error('No instance')
    const nestedCopy = graph.getChildren(instance.id)[0]
    const copy = graph.getChildren(nestedCopy.id)[0]

    const seen = observeWrites(graph)
    bindVariable(graph, copy.id, 'opacity', number.id)
    seen.stop()

    expect(nestedCopy.type).toBe('INSTANCE')
    for (const target of [nestedCopy, instance]) {
      const kept = seen.before.get(target.id)
      expect(
        kept && hasInstanceOverride(kept.overrides, target.id, copy.id, 'boundVariables')
      ).toBe(false)
      expect(
        hasInstanceOverride(target.instanceOverrides, target.id, copy.id, 'boundVariables')
      ).toBe(true)
      expect(seen.touched.has(target.id)).toBe(true)
    }
    expect(
      hasInstanceOverride(instance.instanceOverrides, instance.id, copy.id, opacityClaim)
    ).toBe(true)
  })

  test('an instance bound itself is reported once, before its own overrides change', () => {
    const { graph, instance, number } = setup()

    const seen = observeWrites(graph)
    bindVariable(graph, instance.id, 'opacity', number.id)
    seen.stop()

    const kept = seen.before.get(instance.id)
    expect(kept?.boundVariables).toEqual({})
    expect(
      kept && hasInstanceOverride(kept.overrides, instance.id, instance.id, opacityClaim)
    ).toBe(false)
    expect(
      hasInstanceOverride(instance.instanceOverrides, instance.id, instance.id, opacityClaim)
    ).toBe(true)
    expect(seen.touched.has(instance.id)).toBe(true)
  })
})
