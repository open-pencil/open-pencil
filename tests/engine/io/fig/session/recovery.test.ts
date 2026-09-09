import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import { serializeSceneGraph, deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  createPopulationWorkerClient,
  registerFigPopulationWorker,
  releaseFigPopulationWorker
} from '#core/kiwi/fig/population/client'
import { applyFigPopulationDelta } from '#core/kiwi/fig/population/delta'
import type { FigSessionPopulateRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'
import { openReaderSession } from '#core/kiwi/fig/session/reader'
import {
  registerReaderRecovery,
  updateReaderRecovery,
  recoverReaderPage
} from '#core/kiwi/fig/session/recovery'

test('rejected worker response cannot mark an unloaded page loaded in recovery', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'First' })
  source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Second node' })
  const bytes = await exportFigFile(source)
  const backend = openReaderSession(bytes.buffer as ArrayBuffer, 'first-page')
  const graph = deserializeSceneGraph(serializeSceneGraph(backend.graph))
  registerReaderRecovery(graph, bytes.buffer as ArrayBuffer, structuredClone(backend.checkpoint()))
  let request: FigSessionPopulateRequest | undefined
  const port = {
    onmessage: null as ((event: MessageEvent<FigSessionResponse>) => void) | null,
    start: () => undefined,
    close: () => undefined,
    postMessage: (message: FigSessionPopulateRequest) => {
      request = message
    }
  }
  const worker = {
    terminate: () => undefined,
    postMessage: () => undefined,
    onerror: null,
    onmessage: null
  }
  const client = createPopulationWorkerClient(graph, worker, port)
  const pageId = graph.getPages()[1].id
  try {
    const pending = client.populate(pageId)
    if (!request) throw new Error('Missing request')
    const result = backend.populate(pageId)
    graph.updateNode(graph.rootId, { name: 'Edited locally' })
    port.onmessage?.({
      data: {
        type: 'population-result',
        requestId: request.requestId,
        baseRevision: request.baseRevision,
        ...structuredClone(result)
      }
    } as MessageEvent<FigSessionResponse>)
    expect(await pending).toBeNull()
    expect(graph.getChildren(pageId)).toHaveLength(0)
    expect(recoverReaderPage(graph, pageId)).toBe(true)
    expect(graph.getChildren(pageId)[0].name).toBe('Second node')
    expect(graph.getNode(graph.rootId)?.name).toBe('Edited locally')
  } finally {
    client.terminate()
    releaseFigPopulationWorker(graph)
  }
})

test('page preparation recovers an invalidated replacement worker without replacing edited graph', async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.getPages()[0].id, { name: 'First' })
  source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Second node' })
  source.createNode('RECTANGLE', source.addPage('Third').id, { name: 'Third node' })
  const bytes = await exportFigFile(source)
  const backend = openReaderSession(bytes.buffer as ArrayBuffer, 'first-page')
  const graph = deserializeSceneGraph(serializeSceneGraph(backend.graph))
  registerReaderRecovery(graph, bytes.buffer as ArrayBuffer, structuredClone(backend.checkpoint()))
  const secondResult = backend.populate(graph.getPages()[1].id)
  applyFigPopulationDelta(graph, structuredClone(secondResult.delta))
  if (!secondResult.checkpoint) throw new Error('Missing checkpoint')
  updateReaderRecovery(graph, structuredClone(secondResult.checkpoint))
  const secondNode = graph.getChildren(graph.getPages()[1].id)[0]
  const worker = {
    terminate: () => undefined,
    postMessage: () => undefined,
    onerror: null,
    onmessage: null
  } as Worker
  registerFigPopulationWorker(graph, worker, undefined, true)
  const editor = createEditor({ graph })
  const first = graph.getChildren(graph.getPages()[0].id)[0]
  graph.updateNode(first.id, { name: 'Edited' })
  try {
    await editor.preparePage(graph.getPages()[2].id)
    expect(graph.getChildren(graph.getPages()[1].id)).toEqual([secondNode])
    expect(graph.getChildren(graph.getPages()[2].id)[0].name).toBe('Third node')
    expect(editor.graph).toBe(graph)
    expect(graph.getNode(first.id)).toBe(first)
    expect(first.name).toBe('Edited')
    expect(graph.getChildren(graph.getPages()[1].id)[0].name).toBe('Second node')
  } finally {
    releaseFigPopulationWorker(graph)
  }
  expect(() => recoverReaderPage(graph, graph.getPages()[2].id)).toThrow(
    'No replacement reader recovery state'
  )
})
