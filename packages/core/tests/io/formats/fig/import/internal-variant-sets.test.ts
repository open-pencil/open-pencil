import { expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { switchVariant, syncVariantName } from '#core/figma-api/variants'
import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import { releaseFigPopulationWorker } from '#core/kiwi/fig/population/client'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  loadReaderVariants,
  populateFigInternalPages,
  registerReaderRecovery,
  savedReaderVariants
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

interface LibraryFileOptions {
  chipName?: (state: string) => string
  /** Chip variants saved with a name and no specs. */
  nameOnly?: boolean
  /** An instance of the first icon on the page too, so the icon set is built at open. */
  iconOnPage?: boolean
  /** A chip state whose variant a library owns, so it cannot be edited here. */
  readOnlyState?: string
}

/**
 * Library sets copied onto the internal canvas: a chip whose instance on the page uses one
 * variant, and whose last variant holds an icon from a second set.
 */
async function libraryVariantFile({
  chipName = (state) => `State=${state}`,
  nameOnly = false,
  iconOnPage = false,
  readOnlyState
}: LibraryFileOptions = {}): Promise<Uint8Array> {
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
    if (nameOnly) {
      graph.updateNode(node.id, { componentPropertyValues: {} })
    }
    if (state === readOnlyState) {
      graph.updateNode(node.id, {
        librarySource: {
          identity: { libraryId: 'kit', assetKey: 'chip', revisionId: 'r1' },
          sourceNodeId: null,
          readOnly: true
        }
      })
    }
    return node
  })
  graph.createInstance(iconVariants[0].id, chipVariants[3].id)
  graph.createInstance(chipVariants[0].id, page.id)
  if (iconOnPage) {
    graph.createInstance(iconVariants[0].id, page.id)
  }
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
  const graph = await parseFigFile((await libraryVariantFile({ chipName: misnamed })).slice().buffer, {
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

async function openLazily(options: LibraryFileOptions = {}) {
  const graph = await parseFigFile((await libraryVariantFile(options)).slice().buffer, {
    populate: 'first-page'
  })
  return { graph, editor: createEditor({ graph }) }
}

function chipState(editor: Editor, graph: SceneGraph) {
  const chip = setNamed(graph, 'Chip')
  const [state] = editor.getComponentSetPropertyDefs(chip?.id ?? '')
  return { chipId: chip?.id ?? '', stateId: state.id }
}

function componentNamed(graph: SceneGraph, name: string): SceneNode | undefined {
  return [...graph.nodes.values()].find((node) => node.type === 'COMPONENT' && node.name === name)
}

function optionValues(editor: Editor, graph: SceneGraph, property: string): string[] {
  return editor.getVariantOptionAvailability(pageInstance(graph).id, property).map(({ value }) => value)
}

test('a variant renamed through the plugin API to an unbuilt variant keeps its values', async () => {
  const { graph } = await openLazily()
  const variantId = pageInstance(graph).componentId ?? ''
  graph.updateNode(variantId, { name: 'State=Hover' })
  syncVariantName(graph, graph.getNode(variantId) ?? pageInstance(graph))
  expect(graph.getNode(variantId)?.componentPropertyValues.State).toBe('Default')
})

test('a built variant whose value changed lists its new value, not the saved one', async () => {
  const { graph, editor } = await openLazily()
  const { stateId } = chipState(editor, graph)
  editor.setVariantPropertyValue(pageInstance(graph).componentId ?? '', stateId, 'Idle')
  expect(optionValues(editor, graph, 'State')).toEqual(['Idle', 'Hover', 'Pressed', 'Disabled'])
})

test('a variant saved with a name only keeps its value after its property is renamed', async () => {
  const { graph, editor } = await openLazily({ nameOnly: true })
  const { chipId, stateId } = chipState(editor, graph)
  editor.renamePropertyDefinition(chipId, stateId, 'Status')
  expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'Status')).toEqual(
    allAvailable(STATES)
  )
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues.Status).toBe('Disabled')
})

test('a variant property added to the set reaches the variants not built yet', async () => {
  const { graph, editor } = await openLazily()
  const { chipId } = chipState(editor, graph)
  editor.addPropertyDefinition(chipId, 'Size', 'VARIANT', 'Large')
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues).toEqual({
    State: 'Disabled',
    Size: 'Large'
  })
})

test('renaming a value reaches the variants not built yet', async () => {
  const { graph, editor } = await openLazily()
  const { chipId, stateId } = chipState(editor, graph)
  editor.renameVariantValue(chipId, stateId, 'Disabled', 'Off')
  expect(optionValues(editor, graph, 'State')).toEqual(['Default', 'Hover', 'Pressed', 'Off'])
  const instance = switchState(editor, graph, 'Off')
  expect(graph.getChildren(instance.id).map((node) => node.name)).toEqual([
    'Disabled fill',
    'Kind=Star'
  ])
})

test('a variant nesting a component the user deleted is not built, and the component stays deleted', async () => {
  const { graph, editor } = await openLazily({ iconOnPage: true })
  graph.deleteNode(componentNamed(graph, 'Kind=Star')?.id ?? '')
  expect(editor.switchInstanceVariant(pageInstance(graph).id, 'State', 'Disabled')).toEqual({
    kind: 'unavailable',
    requested: { State: 'Disabled' }
  })
  expect(componentNamed(graph, 'Kind=Star')).toBeUndefined()
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
})

test('a variant built after a live edit to a component it nests shows the edit', async () => {
  const { graph, editor } = await openLazily({ iconOnPage: true })
  const star = componentNamed(graph, 'Kind=Star')
  graph.updateNode(graph.getChildren(star?.id ?? '')[0].id, { opacity: 0.5 })
  const instance = switchToDisabled(editor, graph)
  const variantIcon = graph
    .getChildren(instance.componentId ?? '')
    .find((node) => node.type === 'INSTANCE')
  expect(graph.getChildren(variantIcon?.id ?? '')[0].opacity).toBe(0.5)
})

test('loading the internal canvas keeps a reorder of the variants a switch built', async () => {
  const { graph, editor } = await openLazily()
  switchToDisabled(editor, graph)
  const chip = setNamed(graph, 'Chip')
  const disabled = componentNamed(graph, 'State=Disabled')
  graph.insertChildAt(disabled?.id ?? '', chip?.id ?? '', 0)
  populateFigInternalPages(graph)
  const order = builtValues(graph, 'Chip', 'State')
  expect(order.indexOf('Disabled')).toBeLessThan(order.indexOf('Default'))
  expect(order.toSorted()).toEqual(STATES.toSorted())
})

test('a file opened through the reader worker lists and switches to unbuilt variants', async () => {
  const bytes = (await libraryVariantFile()).slice().buffer
  const graph = await parseFigFileViaWorker(bytes, { populate: 'first-page' })
  try {
    const editor = createEditor({ graph })
    expect(editor.getVariantOptionAvailability(pageInstance(graph).id, 'State')).toEqual(
      allAvailable(STATES)
    )
    const instance = switchToDisabled(editor, graph)
    expect(graph.getChildren(instance.id).map((node) => node.name)).toEqual([
      'Disabled fill',
      'Kind=Star'
    ])
  } finally {
    releaseFigPopulationWorker(graph)
  }
})

function deleteStar(graph: SceneGraph): void {
  graph.deleteNode(componentNamed(graph, 'Kind=Star')?.id ?? '')
}

test('an edit is refused, and changes nothing, while a variant of the set cannot be built', async () => {
  const { graph, editor } = await openLazily({ iconOnPage: true })
  deleteStar(graph)
  const { chipId, stateId } = chipState(editor, graph)
  const nodes = graph.nodes.size
  expect(editor.renameVariantValue(chipId, stateId, 'Disabled', 'Off')).toBe(false)
  expect(graph.nodes.size).toBe(nodes)
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
  expect(optionValues(editor, graph, 'State')).toEqual(STATES)
})

test('a value that a variant the file holds already has is a conflict, built or not', async () => {
  const { graph, editor } = await openLazily({ iconOnPage: true })
  deleteStar(graph)
  const { stateId } = chipState(editor, graph)
  const variantId = pageInstance(graph).componentId ?? ''
  expect(editor.setVariantPropertyValue(variantId, stateId, 'Disabled')).toEqual({
    kind: 'conflict',
    componentIds: [variantId]
  })
  expect(graph.getNode(variantId)?.componentPropertyValues.State).toBe('Default')
})

test('loading the internal canvas is refused while it nests a deleted component', async () => {
  const { graph } = await openLazily({ iconOnPage: true })
  deleteStar(graph)
  expect(() => populateFigInternalPages(graph)).toThrow('deleted')
  expect(componentNamed(graph, 'State=Disabled')).toBeUndefined()
  expect(componentNamed(graph, 'Kind=Star')).toBeUndefined()
})

test('a variant whose set the user deleted is not built', async () => {
  const { graph } = await openLazily()
  const chipId = setNamed(graph, 'Chip')?.id ?? ''
  const unbuiltIds = savedReaderVariants(graph, chipId)
    .filter((variant) => variant.layerId === undefined)
    .map((variant) => variant.id)
  graph.deleteNode(chipId)
  const nodes = graph.nodes.size
  expect(loadReaderVariants(graph, unbuiltIds)).toBe(false)
  expect(graph.nodes.size).toBe(nodes)
})

test('undo and redo of an edit that built the rest of the set', async () => {
  const { graph, editor } = await openLazily()
  const { chipId, stateId } = chipState(editor, graph)
  expect(editor.renameVariantValue(chipId, stateId, 'Disabled', 'Off')).toBe(true)
  editor.undo.undo()
  expect(builtValues(graph, 'Chip', 'State')).toEqual(STATES)
  expect(optionValues(editor, graph, 'State')).toEqual(STATES)
  editor.undo.redo()
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Hover', 'Pressed', 'Off'])
  expect(optionValues(editor, graph, 'State')).toEqual(['Default', 'Hover', 'Pressed', 'Off'])
})

function renameThroughPlugin(graph: SceneGraph, variantId: string, name: string): void {
  graph.updateNode(variantId, { name })
  syncVariantName(graph, graph.getNode(variantId) ?? pageInstance(graph))
}

test('a plugin rename that keeps the values builds nothing', async () => {
  const { graph } = await openLazily()
  const variantId = pageInstance(graph).componentId ?? ''
  renameThroughPlugin(graph, variantId, 'State = Default')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
})

test('a plugin rename to a built twin builds nothing and keeps the values', async () => {
  const { graph, editor } = await openLazily()
  const variantId = pageInstance(graph).componentId ?? ''
  switchState(editor, graph, 'Hover')
  renameThroughPlugin(graph, variantId, 'State=Hover')
  expect(graph.getNode(variantId)?.componentPropertyValues.State).toBe('Default')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default', 'Hover'])
})

test('a plugin rename to an unbuilt twin builds nothing and keeps the values', async () => {
  const { graph } = await openLazily()
  const variantId = pageInstance(graph).componentId ?? ''
  renameThroughPlugin(graph, variantId, 'State=Pressed')
  expect(graph.getNode(variantId)?.componentPropertyValues.State).toBe('Default')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
})

test('a plugin rename to new values builds the rest of the set first', async () => {
  const { graph } = await openLazily()
  const variantId = pageInstance(graph).componentId ?? ''
  renameThroughPlugin(graph, variantId, 'State=Idle')
  expect(graph.getNode(variantId)?.componentPropertyValues.State).toBe('Idle')
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Idle', 'Hover', 'Pressed', 'Disabled'])
})

test('an edit that meets a read-only saved variant throws and removes what it built', async () => {
  const { graph, editor } = await openLazily({ readOnlyState: 'Pressed' })
  const { chipId, stateId } = chipState(editor, graph)
  const nodes = graph.nodes.size
  expect(() => editor.renameVariantValue(chipId, stateId, 'Disabled', 'Off')).toThrow('library')
  expect(graph.nodes.size).toBe(nodes)
  expect(builtValues(graph, 'Chip', 'State')).toEqual(['Default'])
  const instance = switchToDisabled(editor, graph)
  expect(graph.getNode(instance.componentId ?? '')?.componentPropertyValues.State).toBe('Disabled')
})
