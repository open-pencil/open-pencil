import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  registerFigPopulationWorker,
  registerOriginalArchiveRequest,
  releaseFigPopulationWorker,
  requestOriginalArchive
} from '#core/kiwi/fig/population/client'

describe('FIG session ownership', () => {
  test('discards an archive response when the graph changes while it is pending', async () => {
    const graph = new SceneGraph()
    const archive: { resolve: ((bytes: Uint8Array) => void) | null } = { resolve: null }
    registerOriginalArchiveRequest(
      graph,
      () =>
        new Promise<Uint8Array>((resolve) => {
          archive.resolve = resolve
        })
    )
    const request = requestOriginalArchive(graph)

    graph.updateNode(graph.rootId, { name: 'Edited' })
    archive.resolve?.(new Uint8Array([1, 2, 3]))

    await expect(request).resolves.toBeNull()
    releaseFigPopulationWorker(graph)
  })

  test('retains and releases oversized session workers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    for (let index = 0; index < 200_001; index++) {
      graph.nodes.set(`oversized-${index}`, {
        ...page,
        id: `oversized-${index}`,
        childIds: []
      })
    }
    let workerTerminated = false
    let portClosed = false
    const worker = {
      terminate: () => {
        workerTerminated = true
      }
    } as Worker
    const port = {
      postMessage: (_message: unknown) => {
        // The oversized path only disposes the port; it never posts to it.
      },
      close: () => {
        portClosed = true
      }
    } as MessagePort

    registerFigPopulationWorker(graph, worker, port)
    releaseFigPopulationWorker(graph)

    expect(workerTerminated).toBe(true)
    expect(portClosed).toBe(true)
  })

  test.serial('rejects session worker construction outside Worker runtimes', async () => {
    const originalWorker = globalThis.Worker
    Reflect.deleteProperty(globalThis, 'Worker')
    try {
      const { createFigSessionWorker } = await import('#core/kiwi/fig/session/client')
      expect(() => createFigSessionWorker()).toThrow('unavailable')
    } finally {
      globalThis.Worker = originalWorker
    }
  })
})
