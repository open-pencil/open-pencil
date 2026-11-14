import { expect, test } from 'bun:test'

import { populationPort } from '#core-tests/helpers/fig/population-worker'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { createPopulationWorkerClient } from '#core/kiwi/fig/population/client'

function pageWithLayers(count: number) {
  const source = new SceneGraph()
  const page = source.addPage('Loaded')
  const layers = Array.from({ length: count }, (_, index) =>
    structuredClone(source.createNode('RECTANGLE', page.id, { name: `Layer ${index}` }))
  )
  const graph = new SceneGraph()
  const target = graph.addPage('Loaded')
  const moved = layers.map((layer): SceneNode => ({ ...layer, parentId: target.id }))
  return { graph, page: target, layers: moved }
}

test('a page that arrives in pieces gains each piece as it arrives', async () => {
  const { graph, page, layers } = pageWithLayers(4)
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    const { requestId, baseRevision } = worker.request()
    worker.send({ type: 'population-chunk', requestId, created: layers.slice(0, 2) })
    expect(graph.getChildren(page.id)).toHaveLength(2)
    worker.send({ type: 'population-chunk', requestId, created: layers.slice(2) })
    worker.send({
      type: 'population-result',
      requestId,
      baseRevision,
      populated: true,
      delta: {
        created: [],
        updated: [[page.id, { childIds: layers.map((layer) => layer.id) }]],
        deleted: [],
        populatedRootIds: [page.id]
      }
    })
    expect(await pending).toBe(true)
    expect(graph.getChildren(page.id).map((node) => node.name)).toEqual(
      layers.map((layer) => layer.name)
    )
  } finally {
    client.terminate()
  }
})

test('a page load that fails after some pieces leaves none of its layers', async () => {
  const { graph, page, layers } = pageWithLayers(2)
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    const { requestId } = worker.request()
    worker.send({ type: 'population-chunk', requestId, created: layers.slice(0, 1) })
    worker.send({ type: 'population-error', requestId, error: 'Worker failed' })
    expect(await pending).toBeNull()
    expect(graph.getChildren(page.id)).toEqual([])
    expect(graph.getNode(layers[0].id)).toBeUndefined()
  } finally {
    client.terminate()
  }
})

test('a page load that fails keeps a layer added inside its layers meanwhile', async () => {
  const { graph, page, layers } = pageWithLayers(1)
  const frame = { ...layers[0], type: 'FRAME' as const, x: 40, y: 30 }
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    const { requestId } = worker.request()
    worker.send({ type: 'population-chunk', requestId, created: [frame] })
    const added = graph.createNode('RECTANGLE', frame.id, { name: 'Added', x: 5, y: 5 })
    worker.send({ type: 'population-error', requestId, error: 'Worker failed' })
    expect(await pending).toBeNull()
    expect(graph.getNode(frame.id)).toBeUndefined()
    expect(graph.getNode(added.id)?.parentId).toBe(page.id)
    expect(graph.getAbsolutePosition(added.id)).toEqual({ x: 45, y: 35 })
  } finally {
    client.terminate()
  }
})

test('a loaded layer moved or removed before the load finishes stays where the edit left it', async () => {
  const { graph, page, layers } = pageWithLayers(2)
  const [moved, removed] = layers
  const other = graph.createNode('FRAME', page.id, { name: 'Other' })
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    const { requestId, baseRevision } = worker.request()
    worker.send({ type: 'population-chunk', requestId, created: layers })
    graph.reparentNode(moved.id, other.id)
    graph.deleteNode(removed.id)
    worker.send({
      type: 'population-result',
      requestId,
      baseRevision,
      populated: true,
      delta: {
        created: [],
        updated: [[page.id, { childIds: [other.id, moved.id, removed.id] }]],
        deleted: [],
        populatedRootIds: [page.id]
      }
    })
    expect(await pending).toBe(true)
    expect(page.childIds).toEqual([other.id])
    expect(graph.getNode(other.id)?.childIds).toEqual([moved.id])
  } finally {
    client.terminate()
  }
})
