import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import type { FigSessionResponse } from '#core/kiwi/fig/session/protocol'

test('session worker opens and populates using the replacement reader', async () => {
  await initCodec()
  const graph = new SceneGraph()
  graph.createNode('TEXT', graph.getPages()[0].id, { text: 'First' })
  graph.createNode('TEXT', graph.addPage('Second').id, { text: 'Second' })
  const bytes = await exportFigFile(graph)
  const worker = new Worker(
    new URL('../../../../../packages/core/src/kiwi/fig/session/worker.ts', import.meta.url),
    { type: 'module' }
  )
  const channel = new MessageChannel()
  const messages: FigSessionResponse[] = []
  let notify: (() => void) | undefined
  channel.port1.onmessage = (event) => {
    messages.push(event.data)
    notify?.()
  }
  const wait = (type: string) =>
    new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 10000)
      notify = () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  const next = async (type: FigSessionResponse['type']): Promise<FigSessionResponse> => {
    for (;;) {
      const index = messages.findIndex((message) => message.type === type)
      if (index !== -1) return messages.splice(index, 1)[0]
      await wait(type)
    }
  }
  try {
    worker.postMessage(
      {
        type: 'open',
        originalBuffer: bytes.slice().buffer,
        archiveBuffer: bytes.slice().buffer,
        options: { populate: 'first-page' },
        port: channel.port2
      },
      [channel.port2]
    )
    expect((await next('page-manifest')).type).toBe('page-manifest')
    const opened = await next('graph')
    if (opened.type !== 'graph' || !opened.graph) throw new Error('Missing worker graph')
    const { deserializeSceneGraph } = await import('#core/kiwi/fig/parse/transfer')
    const received = deserializeSceneGraph(opened.graph)
    channel.port1.postMessage({ type: 'original-archive', requestId: 'archive' })
    const archive = await next('original-archive-result')
    if (archive.type !== 'original-archive-result') throw new Error('Missing archive response')
    expect(archive.bytes).toEqual(bytes)
    channel.port1.postMessage({
      type: 'populate',
      requestId: 'bad-page',
      baseRevision: 0,
      pageId: 'missing'
    })
    const failure = await next('population-error')
    if (failure.type !== 'population-error') throw new Error('Missing population error')
    expect(failure.requestId).toBe('bad-page')
    expect(failure.error).toContain('Unknown graph page')
    const page = received.getPages()[1]
    channel.port1.postMessage({
      type: 'populate',
      requestId: 'page-2',
      baseRevision: 0,
      pageId: page.id
    })
    const result = await next('population-result')
    expect(result.type).toBe('population-result')
    if (result.type === 'population-result')
      expect(result.delta.created.some(([, node]) => node.text === 'Second')).toBe(true)
    channel.port1.postMessage({ type: 'dispose' })
    await next('disposed')
  } finally {
    channel.port1.close()
    worker.terminate()
  }
}, 20000)
