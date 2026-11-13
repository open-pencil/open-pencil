import { expect, test } from 'bun:test'

import { populationPort } from '#core-tests/helpers/fig/population-worker'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { parseFigFileViaWorker } from '#core/io/formats/fig/read'
import { deserializeSceneGraph, serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  createFigPopulationWorker,
  createPopulationWorkerClient,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { applyFigGraphEdits, trackFigGraphEdits } from '#core/kiwi/fig/population/edits'
import { registerReaderRecovery } from '#core/kiwi/fig/session/document-state'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

const copyOf = (graph: SceneGraph) => deserializeSceneGraph(serializeSceneGraph(graph))
const layers = (graph: SceneGraph) =>
  [...graph.getAllNodes()].sort((a, b) => a.id.localeCompare(b.id))

test('a copy that takes the edits a graph sends stays equal to it', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { name: 'Frame' })
  const moved = graph.createNode('RECTANGLE', frame.id, { name: 'Moved' })
  const removed = graph.createNode('FRAME', page.id, { name: 'Removed' })
  const kept = graph.createNode('RECTANGLE', removed.id, { name: 'Kept' })
  const copy = copyOf(graph)
  const tracker = trackFigGraphEdits(graph, (edits) =>
    applyFigGraphEdits(copy, structuredClone(edits))
  )
  try {
    graph.updateNode(frame.id, { name: 'Renamed', opacity: 0.5 })
    graph.createNode('TEXT', frame.id, { text: 'Added' })
    graph.reparentNode(moved.id, page.id)
    graph.reparentNode(kept.id, frame.id)
    graph.deleteNode(removed.id)
    graph.insertChildAt(frame.id, page.id, 0)
    const collection = graph.createCollection('Theme')
    graph.createVariable('Accent', 'COLOR', collection.id, { r: 1, g: 0, b: 0, a: 1 })
    graph.documentColorSpace = 'display-p3'
    graph.addPage('Added page')
    tracker.flush()
    expect(layers(copy)).toEqual(layers(graph))
    expect([...copy.variables]).toEqual([...graph.variables])
    expect([...copy.variableCollections]).toEqual([...graph.variableCollections])
    expect(copy.documentColorSpace).toBe('display-p3')
  } finally {
    tracker.stop()
  }
})

test('layout a page gets as it loads stays out of the edits', () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id)
  const sent: string[][] = []
  const tracker = trackFigGraphEdits(graph, (edits) => sent.push(edits.nodes.map(({ id }) => id)))
  try {
    graph.applyDerivedLayoutDuring(() => graph.updateNode(frame.id, { width: 300 }))
    tracker.flush()
    expect(sent).toEqual([])
    graph.updateNode(frame.id, { width: 400 })
    tracker.flush()
    expect(sent).toEqual([[frame.id]])
  } finally {
    tracker.stop()
  }
})

async function fileWithInstanceOnSecondPage() {
  await initCodec()
  const source = new SceneGraph()
  const component = source.createNode('COMPONENT', source.getPages()[0].id, { name: 'Card' })
  source.createNode('TEXT', component.id, { name: 'Label', text: 'Before' })
  expectDefined(source.createInstance(component.id, source.addPage('Uses').id), 'instance')
  return exportFigFile(source)
}

const labelOn = (graph: SceneGraph, pageId: string) => {
  const instance = expectDefined(graph.getChildren(pageId)[0], 'instance')
  return graph.getChildren(instance.id)[0]?.text
}

test('a page loaded through the worker after a component edit shows the edit', async () => {
  const bytes = await fileWithInstanceOnSecondPage()
  const opened = await parseFigFileViaWorker(bytes.slice().buffer, { populate: 'first-page' })
  try {
    const component = expectDefined(opened.getChildren(opened.getPages()[0].id)[0], 'component')
    const label = expectDefined(opened.getChildren(component.id)[0], 'label')
    opened.updateNode(label.id, { text: 'After' })
    const uses = opened.getPages()[1]
    expect(await createFigPopulationWorker(opened)?.populate(uses.id)).toBe(true)
    expect(labelOn(opened, uses.id)).toBe('After')
  } finally {
    releaseFigPopulationWorker(opened)
  }
}, 20000)

test('a component edited while a page loads reaches the instances the page brings', async () => {
  const bytes = await fileWithInstanceOnSecondPage()
  const backend = openReaderSession(bytes.slice().buffer, 'first-page')
  const graph = copyOf(backend.graph)
  registerReaderRecovery(graph, bytes.slice().buffer, structuredClone(backend.checkpoint()))
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const uses = graph.getPages()[1]
    const pending = client.populate(uses.id)
    // The worker loads the page from the component as it was.
    const result = structuredClone(backend.populate(uses.id))
    const component = expectDefined(graph.getChildren(graph.getPages()[0].id)[0], 'component')
    graph.updateNode(expectDefined(graph.getChildren(component.id)[0], 'label').id, {
      text: 'After'
    })
    worker.send({
      type: 'population-result',
      requestId: worker.request().requestId,
      baseRevision: worker.request().baseRevision,
      ...result
    })
    expect(await pending).toBe(true)
    expect(labelOn(graph, uses.id)).toBe('After')
  } finally {
    client.terminate()
  }
})
