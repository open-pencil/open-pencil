import { importNodeChanges } from '#core/kiwi/fig/import'
import { serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

import { parseFigBuffer } from './core'

interface WorkerParseRequest {
  buffer: ArrayBuffer
  options?: { populate?: 'all' | 'first-page' }
}

self.onmessage = (e: MessageEvent<ArrayBuffer | WorkerParseRequest>) => {
  try {
    const request = e.data instanceof ArrayBuffer ? { buffer: e.data } : e.data
    const { nodeChanges, blobs, images, figKiwiVersion } = parseFigBuffer(request.buffer)
    const graph = importNodeChanges(nodeChanges, blobs, new Map(images), request.options)
    graph.figKiwiVersion = figKiwiVersion
    self.postMessage({ graph: serializeSceneGraph(graph) })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
