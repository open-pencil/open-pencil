import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { readFixtureArrayBuffer } from '#tests/helpers/fig/fixtures'

function tagsInInput(graph: SceneGraph, rootId: string): SceneNode {
  const found: SceneNode[] = []
  const visit = (id: string) => {
    for (const node of graph.getChildren(id)) {
      if (node.name === 'Tags' && node.boundVariables.paddingLeft) found.push(node)
      visit(node.id)
    }
  }
  visit(rootId)
  expect(found).toHaveLength(1)
  return found[0]
}

test('Gold imported binding units survive token edits and undo/redo', async () => {
  const parsed = parseFigBuffer(readFixtureArrayBuffer('gold-preview.fig'))
  const { graph, sources } = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  })
  const inputId = sources.get('1:3503')
  if (!inputId) throw new Error('Missing input')
  const tags = tagsInInput(graph, inputId)
  const variableId = tags.boundVariables.paddingLeft
  const variable = graph.variables.get(variableId)
  if (!variable) throw new Error('Missing padding binding')
  const mode = graph.getNodeVariableModeId(tags.id, variable.collectionId)
  const editor = createEditor({ graph })
  expect(graph.resolveVariable(variableId, mode)).toBe(8)
  expect(tags.paddingLeft).toBeCloseTo(7.126753330230713, 6)
  expect(tags.variableBindingScales.paddingLeft).toBeCloseTo(0.8908441662788391, 6)
  editor.updateVariableValue(variableId, mode, 16)
  expect(tags.paddingLeft).toBeCloseTo(14.253506660461426, 6)
  expect(graph.getChildren(tags.id)[0].x).toBeCloseTo(tags.paddingLeft, 6)
  editor.undo.undo()
  expect(tags.paddingLeft).toBeCloseTo(7.126753330230713, 6)
  editor.undo.redo()
  expect(tags.paddingLeft).toBeCloseTo(14.253506660461426, 6)
  editor.updateNodeWithUndo(inputId, { name: 'Live variable scale round-trip target' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const reopened = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const restored = materializeDocument(reopened.nodeChanges, reopened.blobs, {
    derivedBounds: true
  })
  const roots = [...restored.graph.getAllNodes()].filter(
    (node) => node.name === 'Live variable scale round-trip target'
  )
  expect(roots).toHaveLength(1)
  const reopenedTags = tagsInInput(restored.graph, roots[0].id)
  expect(reopenedTags.paddingLeft).toBeCloseTo(14.253506660461426, 6)
  expect(reopenedTags.variableBindingScales.paddingLeft).toBeCloseTo(
    tags.variableBindingScales.paddingLeft ?? 1,
    6
  )
})
