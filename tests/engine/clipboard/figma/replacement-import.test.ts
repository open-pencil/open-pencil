import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { prepareClipboardImport } from '#core/clipboard/fig-import'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'

test('replacement clipboard preparation imports real nested component bindings', () => {
  const graph = new SceneGraph()
  const operation = prepareClipboardImport(
    fixture.nodeChanges,
    graph,
    graph.getPages()[0].id,
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    20,
    30
  )
  expect(graph.getChildren(graph.getPages()[0].id)).toHaveLength(0)
  operation.commit()
  const roots = operation.plan.rootIds.map((id) => graph.getNode(id))
  expect(roots.length).toBeGreaterThan(0)
  const sourceId = operation.sourceIds.get('293733:8')
  const placed = graph.getNode(operation.plan.nodeIds.get(sourceId ?? '') ?? '')
  expect(placed).toBeDefined()
  if (!placed) throw new Error('Missing instance')
  const nested = graph.getChildren(placed.id)[0]
  expect(nested.paddingLeft).toBe(6)
  expect(graph.variables.has(nested.boundVariables.paddingLeft)).toBe(true)
  expect(graph.getNode(placed.componentId ?? '')).toBeDefined()
  operation.capture()
  operation.undo()
  expect(graph.getChildren(graph.getPages()[0].id)).toHaveLength(0)
  expect(graph.variables.size).toBe(0)
  operation.redo()
  expect(graph.getNode(placed.id)).toBeDefined()
  expect(graph.getNode(placed.componentId ?? '')).toBeDefined()
})
