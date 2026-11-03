import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph, type VectorNetwork } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 }
  ],
  segments: [0, 1, 2].map((start) => ({
    start,
    end: (start + 1) % 3,
    tangentStart: { x: 0, y: 0 },
    tangentEnd: { x: 0, y: 0 }
  })),
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}

test('opens a vector in a component but not its copy in an instance, as Figma does', () => {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const component = graph.createNode('COMPONENT', pageId, { width: 200, height: 120 })
  const vector = graph.createNode('VECTOR', component.id, {
    width: 100,
    height: 50,
    vectorNetwork: TRIANGLE
  })
  const instance = expectDefined(graph.createInstance(component.id, pageId))
  const copy = expectDefined(graph.getChildren(instance.id)[0])
  const editor = createEditor({ graph })

  editor.enterNodeEditMode(copy.id)
  expect(editor.state.nodeEditState).toBeNull()
  editor.enterNodeEditMode(vector.id)
  expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
})

test('closes the path when its layer is deleted or the document is replaced', () => {
  const graph = new SceneGraph()
  const pageId = expectDefined(graph.getPages()[0]).id
  const open = (target: SceneGraph) =>
    target.createNode('VECTOR', expectDefined(target.getPages()[0]).id, {
      width: 100,
      height: 50,
      vectorNetwork: TRIANGLE
    })
  const vector = open(graph)
  const editor = createEditor({ graph })

  editor.enterNodeEditMode(vector.id)
  graph.deleteNode(graph.createNode('RECTANGLE', pageId).id)
  expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  graph.deleteNode(vector.id)
  expect(editor.state.nodeEditState).toBeNull()

  const next = new SceneGraph()
  editor.enterNodeEditMode(open(graph).id)
  editor.replaceGraph(next)
  expect(editor.state.nodeEditState).toBeNull()
})
