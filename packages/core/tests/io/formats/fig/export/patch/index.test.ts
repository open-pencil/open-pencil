import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { isEqual } from 'es-toolkit/predicate'
import { deflateSync } from 'fflate'

import {
  exportFigFile,
  parseFigFile,
  populateAllFigPages,
  populateFigPage
} from '@open-pencil/core/io/formats/fig'
import { compressFigDataSync, parseFigBuffer } from '@open-pencil/fig'
import {
  initCodec,
  getCompiledSchema,
  getSchemaBytes,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { setDefaultMode } from '@open-pencil/scene-graph/variables'
import { expectDefined } from '@open-pencil/test-support/assert'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'
import {
  hasPendingReaderPages,
  populateFigInternalPages
} from '#core/kiwi/fig/session/document-state'
import { reconcileVariableLayouts } from '#core/layout/variables'

setDefaultTimeout(60_000)

test('independent headless branches preserve distinct new GUIDs across patched saves', async () => {
  const bytes = await fixtureBytes()
  const first = await open(bytes)
  const second = await open(bytes)
  // Imported handles remain usable by headless scripts; only newly authored identities differ.
  expect(layerNamed(first, 'A').id).toBe(layerNamed(second, 'A').id)
  const left = first.createNode('RECTANGLE', first.getPages()[0].id, { name: 'Left branch' })
  const right = second.createNode('RECTANGLE', second.getPages()[0].id, { name: 'Right branch' })
  expect(left.id).not.toBe(right.id)
  const savedLeft = await exportFigFile(first)
  const savedRight = await exportFigFile(second)
  const leftRecord = parseFigBuffer(Uint8Array.from(savedLeft).buffer).nodeChanges.find(
    (record) => record.name === left.name
  )
  const rightRecord = parseFigBuffer(Uint8Array.from(savedRight).buffer).nodeChanges.find(
    (record) => record.name === right.name
  )
  expect(guidToString(expectDefined(leftRecord?.guid))).toBe(left.id)
  expect(guidToString(expectDefined(rightRecord?.guid))).toBe(right.id)
  const reopened = await open(savedLeft)
  expect(layerNamed(reopened, left.name).source.id).toBe(left.id)
  // Saving wrote into the archive: the pages not opened stay unpopulated, and every record the
  // file held, theirs included, is saved under its GUID.
  expect(hasPendingReaderPages(first)).toBe(true)
  const saved = recordsOf(savedLeft)
  expect([...recordsOf(bytes).keys()].filter((guid) => !saved.has(guid))).toEqual([])
})

test('styles added to an opened file are written on the internal canvas, not as layers', async () => {
  const bytes = await fixtureBytes()
  const graph = await open(bytes)
  const page = graph.getPages()[0]
  const style = graph.createNode('RECTANGLE', page.id, {
    name: 'Brand',
    sharedStyleType: 'FILL',
    internalOnly: true
  })
  style.source.id = 'style:a1b2c3d4e5f6'
  graph.updateNode(layerNamed(graph, 'A').id, { fillStyleId: style.source.id })

  const saved = await exportFigFile(graph)
  const records = [...recordsOf(saved).values()]
  const internal = records.find((record) => record.type === 'CANVAS' && record.internalOnly)
  const definition = records.find((record) => record.name === 'Brand')
  expect(definition?.parentIndex?.guid).toEqual(expectDefined(internal?.guid))
  // A style made in OpenPencil is saved under its own ID, as a new layer is.
  expect(guidToString(expectDefined(definition?.guid))).toBe(style.id)
  // The page's layers keep their records: the style takes no place among them.
  const before = recordsOf(bytes)
  for (const name of ['Frame', 'Dot']) {
    const record = records.find((candidate) => candidate.name === name)
    expect(record).toEqual(before.get(guidToString(expectDefined(record?.guid))))
  }
  const reopened = await open(saved)
  const styled = layerNamed(reopened, 'A')
  expect(getSharedStyles(reopened, 'fill').find((s) => s.id === styled.fillStyleId)?.name).toBe(
    'Brand'
  )
})

/** A document over three pages: a frame of layers, a component, and a page of its instances. */
test('an archive whose images Figma cannot read is written whole, every image by its SHA-1', async () => {
  const graph = await open(await legacyImageArchive())
  graph.updateNode(layerNamed(graph, 'Photo 0').id, { name: 'Edited' })

  for (const saved of [
    await exportFigFile(graph),
    await exportFigFile(await open(await legacyImageArchive()))
  ]) {
    const photos = [...recordsOf(saved).values()].filter((record) => record.fillPaints?.length)
    const parsed = parseFigBuffer(saved.slice().buffer as ArrayBuffer)
    expect(photos.map((record) => paintImageName(record))).toEqual([PHOTO_NAME, PHOTO_NAME])
    expect(parsed.images.map(([name]) => name)).toEqual([PHOTO_NAME])
  }
})

const PHOTO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7, 7])
const PHOTO_NAME = computeImageHash(PHOTO)
/** A name an image had before images were named by their SHA-1. */
const LEGACY_NAME = '0123456789abcdef0123456789abcdef01234567'

function paintImageName(record: NodeChange): string | undefined {
  const hash = record.fillPaints?.[0]?.image?.hash
  return hash instanceof Uint8Array ? Buffer.from(hash).toString('hex') : undefined
}

/** Two layers painted with one image that the archive holds under a legacy name. */
async function legacyImageArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  source.images.set(PHOTO_NAME, PHOTO)
  for (const index of [0, 1]) {
    source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: `Photo ${index}`,
      x: index * 50,
      width: 40,
      height: 40,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: PHOTO_NAME,
          imageScaleMode: 'FILL'
        }
      ]
    })
  }
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  for (const record of parsed.nodeChanges) {
    const image = record.fillPaints?.[0]?.image
    if (image) image.hash = Uint8Array.from(Buffer.from(LEGACY_NAME, 'hex'))
  }
  const kiwi = getCompiledSchema().encodeMessage({
    type: 'NODE_CHANGES',
    sessionID: 0,
    ackID: 0,
    nodeChanges: parsed.nodeChanges
  })
  return compressFigDataSync(
    deflateSync(getSchemaBytes()),
    kiwi,
    expectDefined(parsed.thumbnailPNG, 'thumbnail'),
    parsed.metaJSON ?? '{}',
    [{ name: `images/${LEGACY_NAME}`, data: PHOTO }]
  )
}

async function fixtureBytes(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  const [first] = source.getPages()
  const frame = source.createNode('FRAME', first.id, { name: 'Frame', width: 200, height: 200 })
  for (const [index, name] of ['A', 'B', 'C'].entries())
    source.createNode('RECTANGLE', frame.id, { name, x: index * 30, width: 20, height: 20 })
  source.createNode('ELLIPSE', first.id, { name: 'Dot', x: 300, width: 10, height: 10 })
  const library = source.addPage('Library')
  const component = source.createNode('COMPONENT', library.id, {
    name: 'Card',
    width: 100,
    height: 40
  })
  source.createNode('RECTANGLE', component.id, { name: 'Body', width: 100, height: 40 })
  const used = source.addPage('Used')
  const overridden = source.createInstance(component.id, used.id)
  source.createInstance(component.id, used.id, { x: 200 })
  // An override on the component's layer, which the instance's record addresses by its GUID.
  const [overriddenBody] = source.getChildren(overridden?.id ?? '')
  source.updateNode(overriddenBody.id, { opacity: 0.5 })
  const collection = source.createCollection('Tokens')
  const brand = source.createVariable('brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
  source.createNode('RECTANGLE', source.addPage('Bound').id, {
    name: 'Branded',
    width: 10,
    height: 10,
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ],
    boundVariables: { 'fills/0/color': brand.id }
  })
  return exportFigFile(source)
}

const open = (bytes: Uint8Array) =>
  parseFigFile(bytes.slice().buffer as ArrayBuffer, { populate: 'first-page' })

function pageNamed(graph: SceneGraph, name: string): SceneNode {
  const page = graph.getPages().find((candidate) => candidate.name === name)
  if (!page) throw new Error(`Missing page ${name}`)
  return page
}

function layerNamed(graph: SceneGraph, name: string): SceneNode {
  const layer = [...graph.nodes.values()].find((node) => node.name === name)
  if (!layer) throw new Error(`Missing layer ${name}`)
  return layer
}

interface LayerShape {
  name: string
  type: string
  bounds: number[]
  children: LayerShape[]
}

/** What a reopened document shows, independent of the IDs one session gave its layers. */
async function shapeOf(bytes: Uint8Array): Promise<Record<string, LayerShape[]>> {
  const graph = await open(bytes)
  populateAllFigPages(graph)
  const shape = (node: SceneNode): LayerShape => ({
    name: node.name,
    type: node.type,
    bounds: [node.x, node.y, node.width, node.height].map((value) => Math.round(value * 100)),
    children: graph.getChildren(node.id).map(shape)
  })
  return Object.fromEntries(
    graph.getPages().map((page) => [page.name, graph.getChildren(page.id).map(shape)])
  )
}

const guidKey = (record: NodeChange) => (record.guid ? guidToString(record.guid) : '')

/** The records of an archive by GUID. */
function recordsOf(bytes: Uint8Array) {
  const { nodeChanges } = parseFigBuffer(bytes.slice().buffer as ArrayBuffer)
  return new Map(
    nodeChanges.flatMap((record) => (record.guid ? [[guidToString(record.guid), record]] : []))
  )
}

/**
 * Export one edit both ways: writing the changed records into the archive, and the whole
 * document as before. Both must reopen the same.
 */
async function exportBothWays(edit: (graph: SceneGraph) => void) {
  const bytes = await fixtureBytes()
  const patchedGraph = await open(bytes)
  edit(patchedGraph)
  const patched = await exportFigFile(patchedGraph)
  const fullGraph = await open(bytes)
  edit(fullGraph)
  releaseFigArchive(fullGraph)
  const full = await exportFigFile(fullGraph)
  return { bytes, patched, full }
}

describe('writing an edited document into its archive', () => {
  test('rewrites only the record an edit changed', async () => {
    const { bytes, patched } = await exportBothWays((graph) =>
      graph.updateNode(layerNamed(graph, 'B').id, { name: 'B renamed' })
    )
    const before = recordsOf(bytes)
    const after = recordsOf(patched)
    expect([...after.keys()].toSorted()).toEqual([...before.keys()].toSorted())
    const changed = [...after].filter(([guid, record]) => !isEqual(before.get(guid), record))
    expect(changed.map(([, record]) => record.name)).toEqual(['B renamed'])
  })

  test('still rewrites only the edited record once every page is loaded', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    // Loading the last page releases the decoded reader; the archive keeps serving saves.
    populateAllFigPages(graph)
    populateFigInternalPages(graph)
    expect(hasPendingReaderPages(graph)).toBe(false)
    graph.updateNode(layerNamed(graph, 'B').id, { name: 'B renamed' })
    const before = recordsOf(bytes)
    const after = recordsOf(await exportFigFile(graph))
    const changed = [...after].filter(([guid, record]) => !isEqual(before.get(guid), record))
    expect(changed.map(([, record]) => record.name)).toEqual(['B renamed'])
  })

  const edits: Array<[string, (graph: SceneGraph) => void]> = [
    ['moving a layer', (graph) => graph.updateNode(layerNamed(graph, 'A').id, { x: 120, y: 90 })],
    [
      'adding a layer between siblings',
      (graph) => {
        const frame = layerNamed(graph, 'Frame')
        const added = graph.createNode('RECTANGLE', frame.id, { name: 'New', width: 5, height: 5 })
        graph.insertChildAt(added.id, frame.id, 1)
      }
    ],
    ['deleting a frame and its layers', (graph) => graph.deleteNode(layerNamed(graph, 'Frame').id)],
    [
      'moving a layer out of a frame it then deletes',
      (graph) => {
        const page = pageNamed(graph, graph.getPages()[0].name)
        graph.reparentNode(layerNamed(graph, 'C').id, page.id)
        graph.deleteNode(layerNamed(graph, 'Frame').id)
      }
    ],
    [
      'reordering siblings',
      (graph) => graph.insertChildAt(layerNamed(graph, 'C').id, layerNamed(graph, 'Frame').id, 0)
    ],
    [
      'copying a layer with its source GUID, as a paste does',
      (graph) => {
        const dot = layerNamed(graph, 'Dot')
        graph.createNode(dot.type, graph.getPages()[0].id, {
          ...cloneNodeProps(dot, null),
          name: 'Dot copy',
          x: 400
        })
      }
    ],
    [
      'editing a component whose instances are on a page not loaded yet',
      (graph) => {
        populateFigPage(graph, pageNamed(graph, 'Library').id)
        graph.updateNode(layerNamed(graph, 'Body').id, { height: 60 })
        graph.updateNode(layerNamed(graph, 'Card').id, { height: 60 })
      }
    ],
    [
      'overriding a layer inside an instance',
      (graph) => {
        const used = pageNamed(graph, 'Used')
        populateFigPage(graph, used.id)
        const [instance] = graph.getChildren(used.id)
        const [body] = graph.getChildren(instance.id)
        graph.updateNode(body.id, { opacity: 0.5, name: 'Body override' })
      }
    ],
    [
      'deleting a layer of a component whose instances are on a page not loaded yet',
      (graph) => {
        const library = pageNamed(graph, 'Library')
        populateFigPage(graph, library.id)
        const [body] = graph.getChildren(layerNamed(graph, 'Card').id)
        graph.deleteNode(body.id)
      }
    ],
    ['adding a page', (graph) => graph.addPage('Added')]
  ]
  for (const [name, edit] of edits) {
    test(`reopens as the full export does after ${name}`, async () => {
      const { patched, full } = await exportBothWays(edit)
      expect(await shapeOf(patched)).toEqual(await shapeOf(full))
    })
  }

  test("keeps the document's plugin data an edit sets on it", async () => {
    const { patched } = await exportBothWays((graph) => {
      const root = expectDefined(graph.getNode(graph.rootId))
      graph.updateNode(root.id, {
        pluginData: [...root.pluginData, { pluginId: 'probe', key: 'note', value: 'kept' }]
      })
    })
    const reopened = await open(patched)
    expect(reopened.getNode(reopened.rootId)?.pluginData).toContainEqual({
      pluginId: 'probe',
      key: 'note',
      value: 'kept'
    })
  })

  test('keeps a change to the libraries the document enables', async () => {
    const binding = { libraryId: 'ds', revisionId: 'two', enabled: true }
    const { patched } = await exportBothWays((graph) => {
      graph.enabledLibraries.set('ds', binding)
    })
    const reopened = await open(patched)
    expect(reopened.enabledLibraries.get('ds')).toEqual(binding)
  })

  test('keeps every archive record its own when a new variable takes an ID it uses', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    // A new ID that happens to equal a layer's record on a page not loaded yet: the record must
    // stay the layer's.
    const variableGuid = [...recordsOf(bytes)].find(([, record]) => record.name === 'Branded')?.[0]
    if (!variableGuid) throw new Error('Expected the Branded layer record')
    const [collection] = graph.variableCollections.values()
    const [existing] = graph.variables.values()
    graph.addVariable({ ...structuredClone(existing), id: variableGuid, name: 'added' })
    collection.variableIds.push(variableGuid)
    const patched = await exportFigFile(graph)
    const before = recordsOf(bytes)
    const after = recordsOf(patched)
    for (const [guid, record] of before) {
      expect(after.get(guid)?.type).toBe(record.type)
      expect(after.get(guid)?.name).toBe(record.name)
    }
    const added = [...after.values()].filter((record) => !before.has(guidKey(record)))
    expect(added.map((record) => record.name)).toEqual(['added'])
  })

  test('writes a layer into its own record when something cleared its source id', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    // A room's copy of a layer carries no source metadata; the layer's ID still names its record.
    const page = graph.getPages()[0]
    for (const node of [page, ...graph.getChildren(page.id)])
      graph.updateNode(node.id, { source: { ...structuredClone(node.source), id: '' } })
    const patched = await exportFigFile(graph)
    const before = recordsOf(bytes)
    const after = recordsOf(patched)
    expect([...after.keys()].toSorted()).toEqual([...before.keys()].toSorted())
    for (const [guid, record] of before)
      expect(after.get(guid)?.parentIndex).toEqual(record.parentIndex)
  })

  test('keeps layers on unopened pages bound to a variable whose value changes', async () => {
    const { patched } = await exportBothWays((graph) => {
      const [variable] = graph.variables.values()
      const [modeId] = Object.keys(variable.valuesByMode)
      variable.valuesByMode[modeId] = { r: 0, g: 0, b: 1, a: 1 }
    })
    const reopened = await open(patched)
    populateFigPage(reopened, pageNamed(reopened, 'Bound').id)
    const branded = layerNamed(reopened, 'Branded')
    const variableId = branded.boundVariables['fills/0/color']
    expect(reopened.variables.get(variableId)?.name).toBe('brand')
    expect(Object.values(reopened.variables.get(variableId)?.valuesByMode ?? {})[0]).toEqual({
      r: 0,
      g: 0,
      b: 1,
      a: 1
    })
  })

  test('rewrites instances on unopened pages when their component loses a layer', async () => {
    const bytes = await fixtureBytes()
    const graph = await open(bytes)
    populateFigPage(graph, pageNamed(graph, 'Library').id)
    const [body] = graph.getChildren(layerNamed(graph, 'Card').id)
    graph.deleteNode(body.id)
    const before = recordsOf(bytes)
    const after = recordsOf(await exportFigFile(graph))
    const [bodyGuid, bodyRecord] = expectDefined(
      [...before].find(([, record]) => record.name === 'Body')
    )
    const instances = (records: Map<string, NodeChange>) =>
      [...records.values()].filter((record) => record.type === 'INSTANCE')
    // Instances address the component's layer by its GUID in their derived geometry.
    const addressesBody = (record: NodeChange) =>
      JSON.stringify(record).includes(JSON.stringify(bodyRecord.guid))
    expect(instances(before).every(addressesBody)).toBe(true)
    expect(after.has(bodyGuid)).toBe(false)
    expect(instances(after)).toHaveLength(2)
    expect(instances(after).some(addressesBody)).toBe(false)
  })

  test("writes a page's variable mode into its record, and clears it", async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const darkId = expectDefined(source.createMode(collection.id, 'Dark'), 'dark mode')
    source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'Card' })
    const bytes = await exportFigFile(source)

    const pageModes = async (saved: Uint8Array) => (await open(saved)).getPages()[0].variableModes
    const changedRecords = (before: Uint8Array, after: Uint8Array) => {
      const saved = recordsOf(before)
      return [...recordsOf(after)].flatMap(([guid, record]) =>
        isEqual(saved.get(guid), record) ? [] : [record.type]
      )
    }

    const graph = await open(bytes)
    graph.updateNode(graph.getPages()[0].id, { variableModes: { [collection.id]: darkId } })
    const dark = await exportFigFile(graph)
    expect(changedRecords(bytes, dark)).toEqual(['CANVAS'])
    expect(await pageModes(dark)).toEqual({ [collection.id]: darkId })

    const reopened = await open(dark)
    reopened.updateNode(reopened.getPages()[0].id, { variableModes: {} })
    const cleared = await exportFigFile(reopened)
    expect(changedRecords(dark, cleared)).toEqual(['CANVAS'])
    expect(await pageModes(cleared)).toEqual({})
  })

  test('rewrites bound layers below a page or frame whose mode changes', async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const lightId = collection.defaultModeId
    const darkId = expectDefined(source.createMode(collection.id, 'Dark'), 'dark mode')
    const surface = source.createVariable('surface', 'COLOR', collection.id)
    surface.valuesByMode[lightId] = { r: 1, g: 1, b: 1, a: 1 }
    surface.valuesByMode[darkId] = { r: 0, g: 0, b: 0, a: 1 }
    const page = source.getPages()[0]
    const frame = source.createNode('FRAME', page.id, { name: 'Panel' })
    const holder = source.createNode('FRAME', page.id, { name: 'Holder' })
    for (const [name, parentId] of [
      ['On page', holder.id],
      ['In panel', frame.id]
    ]) {
      const card = source.createNode('RECTANGLE', parentId, {
        name,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
      })
      source.bindVariable(card.id, 'fills/0/color', surface.id)
    }
    const internal = source.createNode('CANVAS', source.rootId, { internalOnly: true })
    const stored = source.createNode('RECTANGLE', internal.id, {
      name: 'Internal',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    source.bindVariable(stored.id, 'fills/0/color', surface.id)
    const bytes = await exportFigFile(source)
    const fillOf = (saved: Uint8Array, name: string) =>
      [...recordsOf(saved).values()].find((record) => record.name === name)?.fillPaints?.[0]?.color

    // As the editor sets a mode: bound paints refresh for the layers below it.
    const setMode = (graph: SceneGraph, id: string, modes: Record<string, string>) => {
      graph.updateNode(id, { variableModes: modes })
      reconcileVariableLayouts(graph, { subtrees: [id] })
    }
    const graph = await open(bytes)
    setMode(graph, layerNamed(graph, 'Panel').id, { [collection.id]: darkId })
    const panelDark = await exportFigFile(graph)
    expect(fillOf(panelDark, 'In panel')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(fillOf(panelDark, 'On page')).toEqual({ r: 1, g: 1, b: 1, a: 1 })

    const reopened = await open(panelDark)
    setMode(reopened, reopened.getPages()[0].id, { [collection.id]: darkId })
    const pageDark = await exportFigFile(reopened)
    expect(fillOf(pageDark, 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    const moved = await open(panelDark)
    moved.reparentNode(layerNamed(moved, 'Holder').id, layerNamed(moved, 'Panel').id)
    expect(fillOf(await exportFigFile(moved), 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    // The old parent changes mode too, so only its saved mode shows the moved layer changed.
    const left = await open(panelDark)
    const inner = left.createNode('FRAME', layerNamed(left, 'Holder').id, { name: 'Inner' })
    left.reparentNode(layerNamed(left, 'On page').id, inner.id)
    setMode(left, layerNamed(left, 'Holder').id, { [collection.id]: lightId })
    setMode(left, left.getPages()[0].id, { [collection.id]: darkId })
    const saved = await open(await exportFigFile(left))
    expect(fillOf(await exportFigFile(saved), 'On page')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    setMode(saved, layerNamed(saved, 'Holder').id, { [collection.id]: darkId })
    saved.reparentNode(layerNamed(saved, 'Inner').id, saved.getPages()[0].id)
    expect(fillOf(await exportFigFile(saved), 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })

    // A new default mode reaches layers with no mode of their own.
    const defaults = await open(bytes)
    populateFigInternalPages(defaults)
    setDefaultMode(defaults, collection.id, darkId)
    reconcileVariableLayouts(defaults, { variables: [surface.id] })
    const defaultDark = await exportFigFile(defaults)
    expect(fillOf(defaultDark, 'On page')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(fillOf(defaultDark, 'Internal')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  test('saves a bound paint a variable refreshed, though the variable is back as it was', async () => {
    await initCodec()
    const source = new SceneGraph()
    const collection = source.createCollection('Theme')
    const modeId = collection.defaultModeId
    const brand = source.createVariable('brand', 'COLOR', collection.id, { r: 0, g: 0, b: 1, a: 1 })
    const card = source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: 'Card',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    source.bindVariable(card.id, 'fills/0/color', brand.id)
    // The paint's opacity was edited after it bound, which Figma keeps until the color changes.
    source.updateNode(card.id, { fills: [{ ...card.fills[0], opacity: 0.4 }] })
    const bytes = await exportFigFile(source)

    const graph = await open(bytes)
    // As a collaborator's values arrive: written into the variable, then reconciled.
    const setBrand = (color: Color) => {
      expectDefined(graph.variables.get(brand.id)).valuesByMode[modeId] = color
      reconcileVariableLayouts(graph, { variables: [brand.id] })
    }
    setBrand({ r: 1, g: 0, b: 0, a: 1 })
    expect(layerNamed(graph, 'Card').fills[0]).toMatchObject({
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1
    })
    setBrand({ r: 0, g: 0, b: 1, a: 1 })
    // Each change refreshed the paint, discarding its edit, as Figma does.
    expect(layerNamed(graph, 'Card').fills[0]).toMatchObject({
      color: { r: 0, g: 0, b: 1, a: 1 },
      opacity: 1
    })

    const saved = [...recordsOf(await exportFigFile(graph)).values()]
    const record = expectDefined(saved.find((entry) => entry.name === 'Card'))
    expect(record.fillPaints?.[0]).toMatchObject({ color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1 })
  })

  test('rewrites the variables when one changes', async () => {
    const { patched } = await exportBothWays((graph) => {
      const [variable] = graph.variables.values()
      const [modeId] = Object.keys(variable.valuesByMode)
      variable.valuesByMode[modeId] = { r: 0, g: 0, b: 1, a: 1 }
    })
    const reopened = await open(patched)
    const [variable] = reopened.variables.values()
    expect(Object.values(variable.valuesByMode)[0]).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    expect(reopened.variables.size).toBe(1)
  })
})
