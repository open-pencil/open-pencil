import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

test('Figma API edits reconcile existing scaled bindings without an editor', () => {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const collection = api.createVariableCollection('Spacing')
  const first = api.createVariable('First', 'FLOAT', collection.id, 10)
  const frame = graph.createNode('INSTANCE', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 2.5,
    boundVariables: { paddingLeft: first.id },
    variableBindingScales: { paddingLeft: 0.25 }
  })
  frame.source.format = 'fig'
  const child = graph.createNode('RECTANGLE', frame.id, { width: 5, height: 5 })
  api.setVariableValue(first.id, collection.defaultModeId, 20)
  expect(frame.paddingLeft).toBe(5)
  expect(frame.width).toBe(10)
  expect(child.x).toBe(5)
  api.unbindVariable(frame.id, 'paddingLeft')
  api.setVariableValue(first.id, collection.defaultModeId, 80)
  expect(frame.paddingLeft).toBe(5)
})

test('Figma API copies assigned variable values rather than retaining caller aliases', () => {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const collection = api.createVariableCollection('Colors')
  const variable = api.createVariable('Color', 'COLOR', collection.id)
  const value = { r: 1, g: 0, b: 0, a: 1 }
  api.setVariableValue(variable.id, collection.defaultModeId, value)
  value.r = 0
  expect(variable.valuesByMode[collection.defaultModeId]).toEqual({ r: 1, g: 0, b: 0, a: 1 })
})
