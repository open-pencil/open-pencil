import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

import { resolveFillColor } from '#core/canvas/renderer/colors'
import {
  captureClipboardVariables,
  importClipboardVariables
} from '#core/editor/clipboard/variables'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

test('100 instances repaint derived colors on a token edit, undo, and redo', () => {
  const graph = new SceneGraph()
  const collection = graph.createCollection('Colors')
  const base = graph.createVariable('Base', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  const derived = graph.createVariable('Derived', 'COLOR', collection.id, {
    expression: 'COMPOSE_COLOR',
    color: { aliasId: base.id },
    opacity: 20
  })
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 0.2,
        visible: true,
        blendMode: 'NORMAL'
      }
    ],
    boundVariables: { 'fills/0/color': derived.id }
  })
  const instances = Array.from({ length: 100 }, () =>
    graph.createInstance(component.id, graph.getPages()[0].id)
  )
  const editor = createEditor({ graph })
  const colorOf = (node: typeof component | null) => {
    if (!node) throw new Error('Missing component instance')
    return resolveFillColor(node.fills[0], 0, node, graph, 'srgb')
  }
  editor.updateVariableValue(base.id, collection.defaultModeId, { r: 0, g: 0, b: 1, a: 1 })
  for (const node of [component, ...instances]) {
    expect(colorOf(node)).toEqual({ r: 0, g: 0, b: 1, a: 0.2 })
  }
  editor.undo.undo()
  for (const node of instances) expect(colorOf(node).r).toBe(1)
  editor.undo.redo()
  for (const node of instances) expect(colorOf(node).b).toBe(1)

  const clipboard = captureClipboardVariables(graph, [component])
  expect(clipboard.variables).toHaveLength(2)
  const destination = new SceneGraph()
  const transfer = importClipboardVariables(destination, clipboard)
  transfer.apply()
  const copiedId = transfer.variableIds.get(derived.id) ?? ''
  expect(destination.resolveColorVariable(copiedId)).toEqual({ r: 0, g: 0, b: 1, a: 0.2 })
  const recovered = deserializeSceneGraph(serializeSceneGraph(destination))
  expect(recovered.resolveColorVariable(copiedId)).toEqual({ r: 0, g: 0, b: 1, a: 0.2 })
})
