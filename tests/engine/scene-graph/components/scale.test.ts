import { expect, test } from 'bun:test'

import { SceneGraph, rescaleNodeTree } from '@open-pencil/scene-graph'

import { expectDefined } from '#tests/helpers/assert'

test('nested synchronization converts between explicit source and occurrence coordinates', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const inner = graph.createNode('COMPONENT', page, { paddingTop: 4 })
  graph.createNode('RECTANGLE', inner.id, { width: 20, height: 20 })
  const outer = graph.createNode('COMPONENT', page)
  const template = expectDefined(graph.createInstance(inner.id, outer.id), 'template')
  rescaleNodeTree(graph, template.id, 0.5)
  const placed = expectDefined(graph.createInstance(outer.id, page), 'placed')
  rescaleNodeTree(graph, placed.id, 0.5)
  const nested = expectDefined(graph.getChildren(placed.id)[0], 'nested')
  expect(nested.componentScale).toBe(0.25)
  graph.updateNode(inner.id, { paddingTop: 8 })
  graph.syncInstances(inner.id)
  expect(template.paddingTop).toBe(4)
  graph.syncInstances(outer.id)
  expect(nested.paddingTop).toBe(2)
  expect(graph.getChildren(nested.id)[0].width).toBe(5)
  graph.createNode('RECTANGLE', inner.id, { width: 12, height: 16 })
  graph.syncInstances(inner.id)
  graph.syncInstances(outer.id)
  expect(graph.getChildren(nested.id)[1].width).toBe(3)
  expect(graph.getChildren(nested.id)[1].componentScale).toBe(0.25)
})

test('definition rescaling updates existing descendant coordinate scales', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const inner = graph.createNode('COMPONENT', page, {
    width: 50,
    height: 28,
    paddingLeft: 20,
    paddingRight: 10
  })
  graph.createNode('RECTANGLE', inner.id, { width: 20, height: 20 })
  const outer = graph.createNode('COMPONENT', page)
  const template = expectDefined(graph.createInstance(inner.id, outer.id))
  rescaleNodeTree(graph, template.id, 0.5)
  const placed = expectDefined(graph.createInstance(outer.id, page))
  rescaleNodeTree(graph, placed.id, 0.25)
  const nested = graph.getChildren(placed.id)[0]
  expect(nested.width).toBe(6.25)
  rescaleNodeTree(graph, template.id, 2)
  graph.syncInstances(outer.id)
  expect(nested.width).toBe(12.5)
  expect(nested.height).toBe(7)
  expect(nested.paddingLeft).toBe(5)
  expect(nested.paddingRight).toBe(2.5)
  expect(nested.componentScale).toBe(0.25)
  expect(graph.getChildren(nested.id)[0].componentScale).toBe(0.25)
})

test('rescaling updates live binding and declaration conversions without scaling opacity units', () => {
  const graph = new SceneGraph()
  const root = graph.createNode('INSTANCE', graph.getPages()[0].id, {
    variableBindingScales: { paddingLeft: 0.25, opacity: 0.01 },
    variableAssignmentScales: { paddingLeft: 0.5, opacity: 0.01 },
    boundVariables: { paddingLeft: 'padding', opacity: 'opacity' },
    componentScale: 0.5
  })
  rescaleNodeTree(graph, root.id, 0.5)
  expect(root.componentScale).toBe(0.25)
  expect(root.variableBindingScales).toEqual({ paddingLeft: 0.125, opacity: 0.01 })
  expect(root.variableAssignmentScales.paddingLeft).toBe(0.25)
  expect(root.variableAssignmentScales.opacity).toBe(0.01)
})
