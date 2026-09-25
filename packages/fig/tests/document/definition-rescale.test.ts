import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'
import { expectDefined } from '#tests/helpers/assert'
import { inheritedNestedBindingRecords } from '#tests/helpers/fig/nested-binding'

test('a placed binding does not freeze an unrelated inherited binding', async () => {
  const { graph, sources } = materializeDocument(
    inheritedNestedBindingRecords(),
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const root = expectDefined(sources.get('293733:8'))
  const template = graph.getChildren(expectDefined(sources.get('1:4')))[0]
  const nested = graph.getChildren(root)[0]
  const api = new FigmaAPI(graph)
  createEditor({ graph })
  api.bindVariable(nested.id, 'paddingLeft', '293742:7')
  api.bindVariable(template.id, 'paddingRight', '293733:7')
  await Promise.resolve()
  expect(nested.boundVariables.paddingLeft).toBe('293742:7')
  expect(nested.boundVariables.paddingRight).toBe('293733:7')
  expect(nested.variableBindingScales.paddingRight).toBe(0.25)
  expect(nested.paddingRight).toBe(5)
  api.unbindVariable(nested.id, 'paddingRight')
  api.bindVariable(template.id, 'paddingTop', '293733:7')
  await Promise.resolve()
  expect(nested.boundVariables.paddingRight).toBeUndefined()
  expect(nested.boundVariables.paddingTop).toBe('293733:7')
  expect(nested.boundVariables.paddingLeft).toBe('293742:7')
})

test('definition rescale preserves an explicit placed binding in its declaring units', async () => {
  const { graph, sources } = materializeDocument(
    inheritedNestedBindingRecords(),
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const root = expectDefined(graph.getNode(expectDefined(sources.get('293733:8'))))
  const template = graph.getChildren(expectDefined(sources.get('1:4')))[0]
  const nested = graph.getChildren(root.id)[0]
  const api = new FigmaAPI(graph)
  createEditor({ graph })
  api.getNodeById(root.id).rescale(0.5)
  api.getNodeById(template.id).rescale(2)
  await Promise.resolve()
  api.bindVariable(nested.id, 'paddingLeft', '293742:7')
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([20.5, 10.5, 3])
  api.getNodeById(template.id).rescale(2)
  await Promise.resolve()
  expect([
    root.width,
    root.height,
    nested.width,
    nested.height,
    nested.paddingLeft,
    nested.paddingRight
  ]).toEqual([28, 14, 18, 14, 3, 5])
  expect(nested.variableBindingScales.paddingLeft).toBe(0.25)
  const variable = expectDefined(graph.variables.get('293742:7'))
  const mode = graph.getNodeVariableModeId(nested.id, variable.collectionId)
  api.setVariableValue(variable.id, mode, 16)
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([29, 19, 4])
  api.setVariableValue(variable.id, mode, 12)
  graph.updateNode(root.id, { name: 'Protected rescale acceptance' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  }).graph
  const restored = expectDefined(
    reopened.getAllNodes().find((node) => node.name === 'Protected rescale acceptance')
  )
  const child = reopened.getChildren(restored.id)[0]
  expect([
    restored.width,
    restored.height,
    child.width,
    child.height,
    child.paddingLeft,
    child.paddingRight
  ]).toEqual([28, 14, 18, 14, 3, 5])
})

test('definition rescale propagates occurrence units through editor sync and export', async () => {
  const { graph, sources } = materializeDocument(
    inheritedNestedBindingRecords(),
    fixture.blobs.map((value) => Uint8Array.fromBase64(value)),
    { derivedBounds: true }
  )
  const root = expectDefined(graph.getNode(expectDefined(sources.get('293733:8'))))
  const outer = expectDefined(graph.getNode(expectDefined(sources.get('1:4'))))
  const template = graph.getChildren(outer.id)[0]
  const nested = graph.getChildren(root.id)[0]
  const api = new FigmaAPI(graph)
  createEditor({ graph })
  api.getNodeById(root.id).rescale(0.5)
  await Promise.resolve()
  api.getNodeById(template.id).rescale(2)
  await Promise.resolve()
  expect([
    root.width,
    root.height,
    nested.width,
    nested.height,
    nested.paddingLeft,
    nested.paddingRight
  ]).toEqual([22.5, 7, 12.5, 7, 5, 2.5])
  expect(nested.variableBindingScales.paddingLeft).toBe(0.25)
  api.setVariableValue(
    '293733:7',
    graph.getNodeVariableModeId(
      nested.id,
      expectDefined(graph.variables.get('293733:7')).collectionId
    ),
    40
  )
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([27.5, 17.5, 10])
  api.setVariableValue(
    '293733:7',
    graph.getNodeVariableModeId(
      nested.id,
      expectDefined(graph.variables.get('293733:7')).collectionId
    ),
    20
  )
  graph.updateNode(root.id, { name: 'Definition rescale acceptance' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  }).graph
  const restored = expectDefined(
    reopened.getAllNodes().find((node) => node.name === 'Definition rescale acceptance')
  )
  const child = reopened.getChildren(restored.id)[0]
  expect([
    restored.width,
    restored.height,
    child.width,
    child.height,
    child.paddingLeft,
    child.paddingRight
  ]).toEqual([22.5, 7, 12.5, 7, 5, 2.5])
})
