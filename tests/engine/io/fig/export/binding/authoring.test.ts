import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { cloneInstanceOverrideState } from '@open-pencil/scene-graph'

import oracle from '#tests/fixtures/nested-binding-authoring.json'
import fixture from '#tests/fixtures/nested-binding-ownership-records.json'
import { expectDefined } from '#tests/helpers/assert'
import { inheritedNestedBindingRecords } from '#tests/helpers/fig/nested-binding'

function document(inherited = false) {
  const changes = inherited
    ? inheritedNestedBindingRecords()
    : (structuredClone(fixture.nodeChanges) as NodeChange[])
  const result = materializeDocument(
    changes,
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const root = expectDefined(
    result.graph.getNode(expectDefined(result.sources.get('293733:8'), 'source')),
    'root'
  )
  const nested = expectDefined(result.graph.getChildren(root.id)[0], 'nested')
  return { ...result, root, nested }
}

for (const caller of ['editor', 'api'] as const) {
  test(`${caller} authors new root and nested aliases in occurrence-owner units`, async () => {
    const { graph, root, nested } = document()
    const writer = caller === 'editor' ? createEditor({ graph }) : new FigmaAPI(graph)
    writer.bindVariable(nested.id, 'paddingRight', '293742:7')
    writer.bindVariable(root.id, 'paddingRight', '293742:7')
    expect(nested.paddingRight).toBe(6)
    expect(root.paddingRight).toBe(6)
    expect(nested.width).toBe(17)
    expect(root.width).toBe(33)
    graph.updateNode(root.id, { name: 'Authored binding' })
    await initCodec()
    const bytes = await exportFigFile(graph)
    const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
    const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
      derivedBounds: true
    }).graph
    const restored = expectDefined(
      reopened.getAllNodes().find((node) => node.name === 'Authored binding'),
      'reopened root'
    )
    const child = expectDefined(reopened.getChildren(restored.id)[0], 'reopened child')
    expect(restored.paddingRight).toBe(6)
    expect(child.paddingRight).toBe(6)
    expect(child.boundVariables.paddingRight).toBeDefined()
    expect(child.variableBindingScales.paddingRight).toBe(0.5)
  })
}

test('component edits preserve authored aliases and subsequent declaration units', async () => {
  const { graph, sources, root, nested } = document()
  const editor = createEditor({ graph })
  editor.bindVariable(nested.id, 'paddingRight', '293742:7')
  const component = expectDefined(sources.get('1:2'), 'component')
  editor.updateNodeWithUndo(component, { paddingTop: oracle.componentEdit.sourcePaddingTop })
  await Promise.resolve()
  expect(nested.paddingTop).toBe(oracle.componentEdit.paddingTop)
  expect(nested.height).toBe(oracle.componentEdit.height)
  expect(nested.componentScale).toBe(0.25)
  expect(nested.boundVariables.paddingRight).toBe('293742:7')
  expect(nested.paddingRight).toBe(6)
  expect(root.variableAssignmentScales.paddingRight).toBe(0.5)
  editor.bindVariable(nested.id, 'itemSpacing', '293742:7')
  expect(nested.itemSpacing).toBe(6)
  editor.undo.undo()
  editor.undo.undo()
  await Promise.resolve()
  expect(nested.paddingTop).toBe(1)
  expect(nested.paddingRight).toBe(6)
  editor.undo.redo()
  await Promise.resolve()
  expect(nested.paddingTop).toBe(2)
})

test('saved inherited multiplication stays live through token edits and edited export', async () => {
  const { graph, root, nested } = document(true)
  const editor = createEditor({ graph })
  const variable = expectDefined(graph.variables.get('293733:7'), 'inherited variable')
  const mode = graph.getNodeVariableModeId(nested.id, variable.collectionId)
  expect(nested.paddingLeft).toBe(5)
  editor.updateVariableValue(variable.id, mode, 40)
  expect(nested.paddingLeft).toBe(10)
  editor.undo.undo()
  expect(nested.paddingLeft).toBe(5)
  editor.undo.redo()
  expect(nested.paddingLeft).toBe(10)
  graph.updateNode(root.id, { name: 'Expression round-trip' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  }).graph
  const restored = expectDefined(
    reopened.getAllNodes().find((node) => node.name === 'Expression round-trip'),
    'root'
  )
  const child = expectDefined(reopened.getChildren(restored.id)[0], 'nested')
  expect(child.paddingLeft).toBe(10)
  expect(child.variableBindingScales.paddingLeft).toBe(0.25)
  expect(child.boundVariables.paddingLeft).toBeDefined()
})

test('rebinding the same inherited alias declares new units; undo restores inherited units and claims', () => {
  const { graph, root, nested } = document(true)
  const editor = createEditor({ graph })
  const previous = cloneInstanceOverrideState(root.instanceOverrides)
  expect(nested.paddingLeft).toBe(5)
  expect(nested.variableBindingScales.paddingLeft).toBe(0.25)
  editor.bindVariable(nested.id, 'paddingLeft', '293733:7')
  expect(nested.paddingLeft).toBe(10)
  expect(nested.variableBindingScales.paddingLeft).toBe(0.5)
  editor.undo.undo()
  expect(nested.variableBindingScales.paddingLeft).toBe(0.25)
  expect(nested.paddingLeft).toBe(5)
  expect(nested.variableBindingScales.paddingLeft).toBe(0.25)
  expect(root.instanceOverrides).toEqual(previous)
  editor.undo.redo()
  expect(nested.paddingLeft).toBe(10)
  editor.unbindVariable(nested.id, 'paddingLeft')
  editor.undo.undo()
  expect(nested.variableBindingScales.paddingLeft).toBe(0.5)
  expect(nested.paddingLeft).toBe(10)
})
