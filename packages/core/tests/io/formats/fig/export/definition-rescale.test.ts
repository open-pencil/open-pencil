import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { capturedFigRecordsSchema, readFixture } from '#core-tests/helpers/fig/fixtures'
import { inheritedNestedBindingRecords } from '#core-tests/helpers/fig/nested-binding'

import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { createEditor } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

const fixture = readFixture('nested-binding-ownership-records.json', capturedFigRecordsSchema)

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
  const openpencil = new OpenPencilAPI(api)
  createEditor({ graph })
  openpencil.bindVariable(nested.id, 'paddingLeft', { id: '293742:7' })
  openpencil.bindVariable(template.id, 'paddingRight', { id: '293733:7' })
  await Promise.resolve()
  expect(nested.boundVariables.paddingLeft).toBe('293742:7')
  expect(nested.boundVariables.paddingRight).toBe('293733:7')
  expect(nested.variableBindingScales.paddingRight).toBe(0.25)
  expect(nested.paddingRight).toBe(5)
  openpencil.unbindVariable(nested.id, 'paddingRight')
  openpencil.bindVariable(template.id, 'paddingTop', { id: '293733:7' })
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
  const openpencil = new OpenPencilAPI(api)
  createEditor({ graph })
  expectDefined(api.getNodeById(root.id)).rescale(0.5)
  expectDefined(api.getNodeById(template.id)).rescale(2)
  await Promise.resolve()
  openpencil.bindVariable(nested.id, 'paddingLeft', { id: '293742:7' })
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([20.5, 10.5, 3])
  expectDefined(api.getNodeById(template.id)).rescale(2)
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
  expectDefined(api.variables.getVariableById(variable.id)).setValueForMode(mode, 16)
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([29, 19, 4])
  expectDefined(api.variables.getVariableById(variable.id)).setValueForMode(mode, 12)
  graph.updateNode(root.id, { name: 'Protected rescale acceptance' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  }).graph
  const restored = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.name === 'Protected rescale acceptance')
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
  expectDefined(api.getNodeById(root.id)).rescale(0.5)
  await Promise.resolve()
  expectDefined(api.getNodeById(template.id)).rescale(2)
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
  expectDefined(api.variables.getVariableById('293733:7')).setValueForMode(graph.getNodeVariableModeId(
      nested.id,
      expectDefined(graph.variables.get('293733:7')).collectionId
    ), 40)
  expect([root.width, nested.width, nested.paddingLeft]).toEqual([27.5, 17.5, 10])
  expectDefined(api.variables.getVariableById('293733:7')).setValueForMode(graph.getNodeVariableModeId(
      nested.id,
      expectDefined(graph.variables.get('293733:7')).collectionId
    ), 20)
  graph.updateNode(root.id, { name: 'Definition rescale acceptance' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const parsed = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  const reopened = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    derivedBounds: true
  }).graph
  const restored = expectDefined(
    [...reopened.getAllNodes()].find((node) => node.name === 'Definition rescale acceptance')
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
