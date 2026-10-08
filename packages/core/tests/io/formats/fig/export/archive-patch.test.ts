import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { isEqual } from 'es-toolkit/predicate'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { parseFigBuffer } from '@open-pencil/fig'
import { populateAllFigPages, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type { SceneNode } from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive'
import { hasPendingReaderPages, populateFigInternalPages } from '#core/kiwi/fig/session/document-state'

setDefaultTimeout(60_000)

/** A document over three pages: a frame of layers, a component, and a page of its instances. */
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
  source.createInstance(component.id, used.id)
  source.createInstance(component.id, used.id, { x: 200 })
  const collection = source.createCollection('Tokens')
  source.createVariable('brand', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
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
    ['adding a page', (graph) => graph.addPage('Added')]
  ]
  for (const [name, edit] of edits) {
    test(`reopens as the full export does after ${name}`, async () => {
      const { patched, full } = await exportBothWays(edit)
      expect(await shapeOf(patched)).toEqual(await shapeOf(full))
    })
  }

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
