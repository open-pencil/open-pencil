import { expect, test } from 'bun:test'

import { encodeArchive, open } from '#core-tests/helpers/fig/archive'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'
import { expectDefined } from '@open-pencil/test-support/assert'

const BLUE = {
  type: 'SOLID' as const,
  color: { r: 0, g: 0, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

async function archiveWithoutItsVariables() {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const component = source.createNode('COMPONENT', first.id, { name: 'Card' })
  source.createNode('RECTANGLE', component.id, { name: 'Box', width: 40, fills: [BLUE] })
  source.createNode('TEXT', component.id, { name: 'Label', text: 'Card' })
  const bound = source.createNode('RECTANGLE', first.id, { name: 'Bound', width: 30 })
  source.createNode('RECTANGLE', first.id, { name: 'Plain', width: 20 })
  const collection = source.createCollection('Library')
  const radius = source.createVariable('Radius', 'FLOAT', collection.id, 8)
  const tint = source.createVariable('Tint', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  const caption = source.createVariable('Caption', 'STRING', collection.id, 'Hello')
  const shown = source.createVariable('Shown', 'BOOLEAN', collection.id, true)
  const instance = expectDefined(
    source.createInstance(component.id, source.addPage('Placed').id, { name: 'Placed card' }),
    'instance'
  )
  const [box, label] = source.getChildren(instance.id)
  const editor = createEditor({ graph: source })
  editor.bindVariable(box.id, 'cornerRadius', radius.id)
  editor.bindVariable(box.id, 'fills/0/color', tint.id)
  editor.bindVariable(label.id, 'text', caption.id)
  editor.bindVariable(label.id, 'visible', shown.id)
  editor.bindVariable(bound.id, 'cornerRadius', radius.id)
  editor.bindVariable(bound.id, 'strokeWeight', radius.id)
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer)
  const variableGuids = new Map(
    parsed.nodeChanges.flatMap((record) =>
      record.type === 'VARIABLE' && record.guid ? [[record.name, guidToString(record.guid)]] : []
    )
  )
  parsed.nodeChanges = parsed.nodeChanges.filter((record) => record.type !== 'VARIABLE')
  return { bytes: encodeArchive(parsed), variableGuids }
}

function savedRecord(bytes: Uint8Array, name: string): NodeChange {
  const { nodeChanges } = parseFigBuffer(bytes.slice().buffer)
  return expectDefined(
    nodeChanges.find((record) => record.name === name),
    name
  )
}

function aliasGuids(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(aliasGuids)
  }
  if (value === null || typeof value !== 'object') {
    return []
  }
  const own =
    'alias' in value &&
    typeof value.alias === 'object' &&
    value.alias !== null &&
    'guid' in value.alias &&
    typeof value.alias.guid === 'object' &&
    value.alias.guid !== null &&
    'sessionID' in value.alias.guid &&
    'localID' in value.alias.guid
      ? [`${String(value.alias.guid.sessionID)}:${String(value.alias.guid.localID)}`]
      : []
  return [...own, ...Object.values(value).flatMap(aliasGuids)]
}

function layerNamed(graph: SceneGraph, name: string): SceneNode {
  return expectDefined(
    [...graph.getAllNodes()].find((node) => node.name === name),
    name
  )
}

test('a page loaded after a component edit saves overrides bound to variables the file lacks', async () => {
  const { bytes, variableGuids } = await archiveWithoutItsVariables()
  const graph = await open(bytes)
  graph.updateNode(layerNamed(graph, 'Box').id, { width: 60 })
  const placedPage = expectDefined(
    graph.getPages().find((page) => page.name === 'Placed'),
    'placed page'
  )
  populateFigPage(graph, placedPage.id)

  const first = await exportFigFile(graph)
  const second = await exportFigFile(graph)

  for (const saved of [first, second]) {
    const instance = savedRecord(saved, 'Placed card').symbolData
    expect(new Set(aliasGuids(instance))).toEqual(new Set(variableGuids.values()))
  }
})

test('an edited layer bound to a variable the file lacks keeps the binding it was read with', async () => {
  const { bytes, variableGuids } = await archiveWithoutItsVariables()
  const graph = await open(bytes)
  graph.updateNode(layerNamed(graph, 'Bound').id, { width: 50 })

  const record = savedRecord(await exportFigFile(graph), 'Bound')

  expect(record.size?.x).toBe(50)
  expect(aliasGuids(record)).toContain(expectDefined(variableGuids.get('Radius'), 'radius'))
})

async function nestedArchiveWithoutItsVariables() {
  await initCodec()
  const source = new SceneGraph()
  const first = source.getPages()[0]
  const inner = source.createNode('COMPONENT', first.id, { name: 'Inner' })
  source.createNode('RECTANGLE', inner.id, { name: 'Corner', width: 40 })
  const outer = source.createNode('COMPONENT', first.id, { name: 'Outer', x: 200 })
  const nested = expectDefined(source.createInstance(inner.id, outer.id), 'nested instance')
  const collection = source.createCollection('Library')
  const small = source.createVariable('Small', 'FLOAT', collection.id, 4)
  const large = source.createVariable('Large', 'FLOAT', collection.id, 12)
  const editor = createEditor({ graph: source })
  editor.bindVariable(source.getChildren(nested.id)[0].id, 'cornerRadius', small.id)
  const placed = expectDefined(
    source.createInstance(outer.id, source.addPage('Placed').id, { name: 'Placed outer' }),
    'placed instance'
  )
  const placedNested = source.getChildren(placed.id)[0]
  editor.bindVariable(source.getChildren(placedNested.id)[0].id, 'cornerRadius', large.id)
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer)
  const variableGuids = new Map(
    parsed.nodeChanges.flatMap((record) =>
      record.type === 'VARIABLE' && record.guid ? [[record.name, guidToString(record.guid)]] : []
    )
  )
  parsed.nodeChanges = parsed.nodeChanges.filter((record) => record.type !== 'VARIABLE')
  return { bytes: encodeArchive(parsed), variableGuids }
}

test('an outer override rebinding a nested layer saves the variable it rebinds to', async () => {
  const { bytes, variableGuids } = await nestedArchiveWithoutItsVariables()
  const graph = await open(bytes)
  graph.updateNode(layerNamed(graph, 'Corner').id, { width: 60 })
  const placedPage = expectDefined(
    graph.getPages().find((page) => page.name === 'Placed'),
    'placed page'
  )
  populateFigPage(graph, placedPage.id)

  const saved = await exportFigFile(graph)

  expect(aliasGuids(savedRecord(saved, 'Placed outer').symbolData)).toContain(
    expectDefined(variableGuids.get('Large'), 'large')
  )
})

test('a rescaled layer bound to a variable the file lacks saves its new binding scale', async () => {
  const { bytes, variableGuids } = await archiveWithoutItsVariables()
  const graph = await open(bytes)
  rescaleNodeTree(graph, layerNamed(graph, 'Bound').id, 2)

  const record = savedRecord(await exportFigFile(graph), 'Bound')

  const radius = expectDefined(variableGuids.get('Radius'), 'radius')
  const multiplied = JSON.stringify(record).match(/"floatValue":2\b/)
  expect(aliasGuids(record)).toContain(radius)
  expect(multiplied).not.toBeNull()
})

test('a binding to a variable the file lacks saves on a layer it was copied to', async () => {
  const { bytes, variableGuids } = await archiveWithoutItsVariables()
  const graph = await open(bytes)
  const bound = layerNamed(graph, 'Bound')
  graph.updateNode(layerNamed(graph, 'Plain').id, {
    boundVariables: { cornerRadius: bound.boundVariables.cornerRadius },
    cornerRadius: bound.cornerRadius
  })

  const record = savedRecord(await exportFigFile(graph), 'Plain')

  expect(aliasGuids(record)).toContain(expectDefined(variableGuids.get('Radius'), 'radius'))
})

test('undoing an unbind keeps the other bindings to variables the file lacks', async () => {
  const { bytes, variableGuids } = await archiveWithoutItsVariables()
  const graph = await open(bytes)
  const editor = createEditor({ graph })
  const bound = layerNamed(graph, 'Bound')
  editor.unbindVariable(bound.id, 'strokeWeight')
  editor.undo.undo()

  const record = savedRecord(await exportFigFile(graph), 'Bound')

  expect(Object.keys(layerNamed(graph, 'Bound').boundVariables).sort()).toEqual([
    'cornerRadius',
    'strokeWeight'
  ])
  const radius = expectDefined(variableGuids.get('Radius'), 'radius')
  const fieldsBoundToRadius = (record.variableConsumptionMap?.entries ?? []).flatMap((entry) =>
    aliasGuids(entry).includes(radius) ? [entry.variableField] : []
  )
  expect(fieldsBoundToRadius.sort()).toEqual(['CORNER_RADIUS', 'STROKE_WEIGHT'])
})
