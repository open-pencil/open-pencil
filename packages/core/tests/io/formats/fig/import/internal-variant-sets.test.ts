import { expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { switchVariant } from '#core/figma-api/variants'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  populateFigInternalPages,
  registerReaderRecovery
} from '#core/kiwi/fig/session/document-state'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

const STATES = ['Default', 'Hover', 'Pressed', 'Disabled']
const KINDS = ['Star', 'Heart', 'Dot']

function variantSet(graph: SceneGraph, parentId: string, name: string, property: string) {
  return graph.createNode('COMPONENT_SET', parentId, {
    name,
    componentPropertyDefinitions: [
      { id: `${name}:prop`, name: property, type: 'VARIANT', defaultValue: '' }
    ]
  })
}

function variant(graph: SceneGraph, setId: string, property: string, value: string, x: number) {
  const node = graph.createNode('COMPONENT', setId, {
    name: `${property}=${value}`,
    x,
    width: 100,
    height: 40,
    componentPropertyValues: { [property]: value }
  })
  graph.createNode('RECTANGLE', node.id, { name: `${value} fill`, width: 100, height: 40 })
  return node
}

/**
 * Library sets copied onto the internal canvas: a chip whose instance on the page uses one
 * variant, and whose last variant holds an icon from a second set nothing else uses.
 */
async function libraryVariantFile(
  chipName: (state: string) => string = (state) => `State=${state}`
): Promise<Uint8Array> {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const internal = graph.addPage('Internal Only Canvas')
  graph.updateNode(internal.id, { internalOnly: true })
  const icons = variantSet(graph, internal.id, 'Icon', 'Kind')
  const iconVariants = KINDS.map((kind, index) => variant(graph, icons.id, 'Kind', kind, index * 120))
  const chip = variantSet(graph, internal.id, 'Chip', 'State')
  const chipVariants = STATES.map((state, index) => {
    const node = variant(graph, chip.id, 'State', state, index * 120)
    graph.updateNode(node.id, { name: chipName(state) })
    return node
  })
  graph.createInstance(iconVariants[0].id, chipVariants[3].id)
  graph.createInstance(chipVariants[0].id, page.id)
  return exportFigFile(graph)
}

function setNamed(graph: SceneGraph, name: string): SceneNode | undefined {
  return [...graph.nodes.values()].find(
    (node) => node.type === 'COMPONENT_SET' && node.name === name
  )
}

function builtValues(graph: SceneGraph, setName: string, property: string): string[] {
  const set = setNamed(graph, setName)
  return set
    ? graph.getChildren(set.id).map((node) => node.componentPropertyValues[property] ?? '')
    : []
}

function allAvailable(values: readonly string[]) {
  return values.map((value) => ({ value, available: true }))
}

function pageInstance(graph: SceneGraph): SceneNode {
  const instance = graph.getChildren(graph.getPages()[0].id)[0]
  if (instance?.type !== 'INSTANCE') {
    throw new Error('Expected the chip instance')
  }
  return instance
}

function switchState(editor: Editor, graph: SceneGraph, state: string): SceneNode {
  const instance = pageInstance(graph)
  const [definition] = editor.getInstanceComponentPropertyDefinitions(instance.id)
  editor.setInstanceComponentProperty(instance.id, definition.id, state)
  return pageInstance(graph)
}

function switchToDisabled(editor: Editor, graph: SceneGraph): SceneNode {
  return switchState(editor, graph, 'Disabled')
}

for (const populate of ['all', 'first-page'] as const) {
  test(`an internal set builds only the used variant and lists every option (${populate})`, async () => {
    const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, { populate })
    expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
    expect(setNamed(graph, 'Icon')).toBeUndefined()
    const editor = createEditor({ graph })
    expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'State')).toEqual(
      allAvailable(STATES)
    )
  })
}

test('switching to an unbuilt variant builds it, with the sets it uses, in saved order', async () => {
  const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, {
    populate: 'first-page'
  })
  const editor = createEditor({ graph })
  const instance = switchToDisabled(editor, graph)
  const target = graph.getNode(instance.componentId ?? '')
  expect(target?.componentPropertyValues.State).toBe('Disabled')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Disabled'])
  expect(graph.getChildren(instance.id).map((node) => node.name)).toEqual([
    'Disabled fill',
    'Kind=Star'
  ])
  expect(builtValues(graph, 'Icon', 'Kind')).toEqual(['Star'])
  const icon = graph.getChildren(target?.id ?? '').find((node) => node.type === 'INSTANCE')
  expect(editor.getVariantOptionAvailability(icon?.id ?? '', 'Kind')).toEqual(
    allAvailable(KINDS)
  )

  editor.undo.undo()
  expect(graph.getNode(pageInstance(graph).componentId ?? '')?.componentPropertyValues.State).toBe(
    'Default'
  )
  switchState(editor, graph, 'Hover')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Hover', 'Disabled'])
})

test('saving after a switch keeps every variant record as it was', async () => {
  const original = await libraryVariantFile()
  const graph = await parseFigFile(original.slice().buffer, { populate: 'first-page' })
  switchToDisabled(createEditor({ graph }), graph)
  const saved = await exportFigFile(graph)

  const records = (bytes: Uint8Array) =>
    new Map(
      parseFigBuffer(bytes.slice().buffer).nodeChanges.flatMap((record) =>
        record.guid ? [[guidToString(record.guid), JSON.stringify(record)] as const] : []
      )
    )
  const before = records(original)
  const after = records(saved)
  const variantIds = [...before].flatMap(([id, record]) =>
    record.includes('"type":"SYMBOL"') ? [id] : []
  )
  expect(variantIds).toHaveLength(STATES.length + KINDS.length)
  for (const id of variantIds) {
    expect(after.get(id)).toBe(before.get(id))
  }
  const instanceId = pageInstance(graph).id
  expect(after.get(instanceId)).not.toBe(before.get(instanceId))

  const reopened = await parseFigFile(saved.slice().buffer, { populate: 'first-page' })
  expect(
    createEditor({ graph: reopened }).getVariantOptionAvailability(
      pageInstance(reopened).id,
      'State'
    )
  ).toEqual(allAvailable(STATES))
})

test('a graph a worker loaded switches to an unbuilt variant from its checkpoint', async () => {
  const bytes = (await libraryVariantFile()).slice().buffer
  const opened = openReaderSession(bytes.slice(0), 'first-page')
  const graph = deserializeSceneGraph(serializeSceneGraph(opened.graph))
  registerReaderRecovery(graph, bytes, opened.checkpoint())
  const editor = createEditor({ graph })
  expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'State')).toEqual(
    allAvailable(STATES)
  )
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues.State).toBe('Disabled')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Disabled'])
})

test('undo and redo of a switch to an unbuilt variant keep the variant it built', async () => {
  const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, {
    populate: 'first-page'
  })
  const editor = createEditor({ graph })
  switchToDisabled(editor, graph)
  editor.undo.undo()
  editor.undo.redo()
  const instance = pageInstance(graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues.State).toBe('Disabled')
  expect(graph.getChildren(instance.id).map((node) => node.name)).toEqual([
    'Disabled fill',
    'Kind=Star'
  ])
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Disabled'])
})

test('loading the internal canvas after a switch adds the other variants once, in saved order', async () => {
  const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, {
    populate: 'first-page'
  })
  switchToDisabled(createEditor({ graph }), graph)
  populateFigInternalPages(graph)
  expect(builtValues(graph, 'Chip', 'State')).toEqual(STATES)
  expect(builtValues(graph, 'Icon', 'Kind')).toEqual(KINDS)
  const chip = setNamed(graph, 'Chip')
  const variantLayers = graph
    .getChildren(chip?.id ?? '')
    .map((variant) => graph.getChildren(variant.id).map((node) => node.name))
  expect(variantLayers).toEqual([
    ['Default fill'],
    ['Hover fill'],
    ['Pressed fill'],
    ['Disabled fill', 'Kind=Star']
  ])
})

test('a variant whose name disagrees with its saved values is listed and found by its values', async () => {
  const misnamed = (state: string) => (state === 'Disabled' ? 'State=Off' : `State=${state}`)
  const graph = await parseFigFile((await libraryVariantFile(misnamed)).slice().buffer, {
    populate: 'first-page'
  })
  const editor = createEditor({ graph })
  expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'State')).toEqual(
    allAvailable(STATES)
  )
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.name).toBe('State=Off')
})

test('a set whose property was renamed lists and switches to its unbuilt variants', async () => {
  const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, {
    populate: 'first-page'
  })
  const editor = createEditor({ graph })
  const chip = setNamed(graph, 'Chip')
  const [state] = editor.getComponentSetPropertyDefs(chip?.id ?? '')
  editor.renamePropertyDefinition(chip?.id ?? '', state.id, 'Status')
  expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'Status')).toEqual(
    allAvailable(STATES)
  )
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues).toEqual({
    Status: 'Disabled'
  })
})

test('setProperties from the plugin API switches to an unbuilt variant', async () => {
  const graph = await parseFigFile((await libraryVariantFile()).slice().buffer, {
    populate: 'first-page'
  })
  const editor = createEditor({ graph })
  const instance = pageInstance(graph)
  const [definition] = editor.getInstanceComponentPropertyDefinitions(instance.id)
  switchVariant(graph, instance, [{ definition, value: 'Pressed' }])
  expect(graph.getNode(pageInstance(graph).componentId ?? '')?.componentPropertyValues.State).toBe(
    'Pressed'
  )
})
