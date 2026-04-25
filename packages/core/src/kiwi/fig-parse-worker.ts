import { importNodeChanges } from './fig-import'
import { parseFigBuffer } from './fig-parse-core'
import { serializeSceneGraph } from './graph-transfer'

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const { nodeChanges, blobs, images, figKiwiVersion } = parseFigBuffer(e.data)
    const graph = importNodeChanges(nodeChanges, blobs, new Map(images))
    graph.figKiwiVersion = figKiwiVersion
    self.postMessage({ graph: serializeSceneGraph(graph) })
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) })
  }
}
