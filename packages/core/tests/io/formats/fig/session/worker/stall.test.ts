import { afterEach, expect, jest, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createPopulationWorkerClient } from '#core/kiwi/fig/population/client'
import type { FigSessionPopulateRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'

afterEach(() => {
  jest.useRealTimers()
})

function workerClient() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  let request: FigSessionPopulateRequest | undefined
  let terminated = false
  const port = {
    onmessage: null as ((event: MessageEvent<FigSessionResponse>) => void) | null,
    start: () => undefined,
    close: () => undefined,
    postMessage(message: FigSessionPopulateRequest) {
      request = message
    }
  }
  const worker = {
    terminate: () => {
      terminated = true
    },
    postMessage: () => undefined,
    onerror: null,
    onmessage: null
  }
  const client = createPopulationWorkerClient(graph, worker, port)
  const send = (data: FigSessionResponse) =>
    port.onmessage?.(new MessageEvent<FigSessionResponse>('message', { data }))
  const sent = () => {
    if (!request) throw new Error('Missing request')
    return request
  }
  return { client, graph, page, send, sent, terminated: () => terminated }
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
    delta: { created: [], updated: [], deleted: [], instanceIndex: [], populatedRootIds: [] }
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
 * An edit makes the worker's result unusable, so progress no longer keeps the load waiting: the
 * page loads on the main thread at once instead of after the worker finishes for nothing.
 */
test('an edit during a page load that keeps reporting progress ends the wait at once', async () => {
  jest.useFakeTimers()
  const { client, graph, page, send, sent } = workerClient()
  const pending = client.populate(page.id)
  send({ type: 'population-progress', requestId: sent().requestId })
  graph.createNode('RECTANGLE', page.id)
  send({ type: 'population-progress', requestId: sent().requestId })
  expect(await pending).toBeNull()
  client.terminate()
})
