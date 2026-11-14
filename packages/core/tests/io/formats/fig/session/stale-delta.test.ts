import { expect, test } from 'bun:test'

import { populationPort } from '#core-tests/helpers/fig/population-worker'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createPopulationWorkerClient } from '#core/kiwi/fig/population/client'
import type { FigPopulationDelta } from '#core/kiwi/fig/population/delta'

const emptyDelta = (): FigPopulationDelta => ({
  created: [],
  updated: [],
  deleted: [],
  instanceIndex: [],
  populatedRootIds: []
})

test('an abandoned page load keeps the worker and applies when it arrives', async () => {
  const graph = new SceneGraph()
  const page = graph.addPage('Later')
  const template = graph.createNode('RECTANGLE', graph.getPages()[0].id)
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const controller = new AbortController()
    const pending = client.populate(page.id, controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
    expect(worker.terminated()).toBe(false)

    const loaded = { ...template, id: 'loaded', parentId: page.id, name: 'Loaded' }
    worker.send({
      type: 'population-result',
      requestId: worker.request().requestId,
      baseRevision: worker.request().baseRevision,
      populated: true,
      delta: {
        ...emptyDelta(),
        created: [['loaded', loaded]],
        updated: [[page.id, { childIds: ['loaded'] }]]
      }
    })
    expect(graph.getChildren(page.id).map((node) => node.name)).toEqual(['Loaded'])
    expect(client.populate(page.id)).not.toBeNull()
  } finally {
    client.terminate()
  }
})

test('a page load answered for another revision is rejected', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    worker.send({
      type: 'population-result',
      requestId: worker.request().requestId,
      baseRevision: worker.request().baseRevision + 1,
      populated: true,
      delta: { ...emptyDelta(), updated: [[page.id, { name: 'Loaded' }]] }
    })
    expect(await pending).toBeNull()
    expect(page.name).not.toBe('Loaded')
  } finally {
    client.terminate()
  }
})

for (const edit of ['an add', 'an add, then an edit elsewhere', 'a reorder'] as const) {
  test(`a page load keeps the page's layers after ${edit} while it loaded`, async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const first = graph.createNode('RECTANGLE', page.id)
    const second = graph.createNode('RECTANGLE', page.id)
    const worker = populationPort()
    const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
    try {
      const pending = client.populate(page.id)
      if (edit !== 'a reorder') graph.createNode('RECTANGLE', page.id)
      if (edit === 'an add, then an edit elsewhere') {
        // The add is sent before the result arrives; the later edit is sent as it arrives.
        await Promise.resolve()
        graph.updateNode(first.id, { name: 'Elsewhere' })
      }
      if (edit === 'a reorder') graph.insertChildAt(second.id, page.id, 0)
      const expected = [...page.childIds]
      const loaded = { ...first, id: 'loaded', parentId: page.id, name: 'Loaded' }
      worker.send({
        type: 'population-result',
        requestId: worker.request().requestId,
        baseRevision: worker.request().baseRevision,
        populated: true,
        delta: {
          ...emptyDelta(),
          created: [['loaded', loaded]],
          updated: [[page.id, { childIds: [first.id, 'loaded'], name: 'Loaded page' }]]
        }
      })
      expect(await pending).toBe(true)
      expect(page.childIds).toEqual([...expected, 'loaded'])
      expect(page.name).not.toBe('Loaded page')
      await Promise.resolve()
      // The worker built the page without the edit, so it takes this thread's page.
      expect(worker.edits.at(-1)?.nodes.find((node) => node.id === page.id)?.childIds).toEqual(
        page.childIds
      )
    } finally {
      client.terminate()
    }
  })
}

test('a layer removed while its page loaded keeps the loaded layers out', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id)
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  try {
    const pending = client.populate(page.id)
    graph.deleteNode(frame.id)
    const loaded = { ...frame, id: 'loaded', parentId: frame.id, type: 'RECTANGLE' as const }
    worker.send({
      type: 'population-result',
      requestId: worker.request().requestId,
      baseRevision: worker.request().baseRevision,
      populated: true,
      delta: {
        ...emptyDelta(),
        created: [['loaded', loaded]],
        updated: [[frame.id, { childIds: ['loaded'] }]]
      }
    })
    expect(await pending).toBe(true)
    expect(graph.getNode('loaded')).toBeUndefined()
    await Promise.resolve()
    expect(worker.edits.at(-1)?.removed).toContain('loaded')
  } finally {
    client.terminate()
  }
})
