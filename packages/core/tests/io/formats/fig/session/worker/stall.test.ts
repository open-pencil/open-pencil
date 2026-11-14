import { afterEach, expect, jest, test } from 'bun:test'

import { populationPort } from '#core-tests/helpers/fig/population-worker'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createPopulationWorkerClient } from '#core/kiwi/fig/population/client'

afterEach(() => {
  jest.useRealTimers()
})

function workerClient() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const worker = populationPort()
  const client = createPopulationWorkerClient(graph, worker.worker, worker.port)
  return {
    client,
    graph,
    page,
    send: worker.send,
    sent: worker.request,
    terminated: worker.terminated
  }
}

/**
 * A large page of a design kit takes the worker longer than the stall window, and loading it
 * again on the main thread after giving up costs as much again. Progress keeps the load alive.
 */
test('a page load that keeps reporting progress outlives the stall window', async () => {
  jest.useFakeTimers()
  const { client, page, send, sent, terminated } = workerClient()
  const pending = client.populate(page.id)
  for (let second = 0; second < 90; second++) {
    jest.advanceTimersByTime(1000)
    send({ type: 'population-progress', requestId: sent().requestId })
  }
  expect(terminated()).toBe(false)
  send({
    type: 'population-result',
    requestId: sent().requestId,
    baseRevision: sent().baseRevision,
    populated: true,
    delta: { created: [], updated: [], deleted: [], populatedRootIds: [] }
  })
  expect(await pending).toBe(true)
  client.terminate()
})

test('a page load that stops reporting progress falls back once the stall window passes', async () => {
  jest.useFakeTimers()
  const { client, page, send, sent, terminated } = workerClient()
  const pending = client.populate(page.id)
  jest.advanceTimersByTime(10_000)
  send({ type: 'population-progress', requestId: sent().requestId })
  jest.advanceTimersByTime(29_999)
  expect(terminated()).toBe(false)
  jest.advanceTimersByTime(1)
  expect(terminated()).toBe(true)
  expect(await pending).toBeNull()
})

/**
 * The worker has the edits made while it loads a page, so they do not end the load: the page
 * still loads there instead of on the main thread.
 */
test('an edit during a page load keeps the load going', async () => {
  jest.useFakeTimers()
  const { client, graph, page, send, sent, terminated } = workerClient()
  const pending = client.populate(page.id)
  send({ type: 'population-progress', requestId: sent().requestId })
  graph.createNode('RECTANGLE', page.id)
  send({ type: 'population-progress', requestId: sent().requestId })
  send({
    type: 'population-result',
    requestId: sent().requestId,
    baseRevision: sent().baseRevision,
    populated: true,
    delta: { created: [], updated: [], deleted: [], populatedRootIds: [] }
  })
  expect(await pending).toBe(true)
  expect(terminated()).toBe(false)
  client.terminate()
})
