import { parseFigBuffer } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { importNodeChanges } from '#core/kiwi/fig/import'
import { getLazyFigImportContext, populateLazyFigImportRoots } from '#core/kiwi/fig/lazy-import'
import {
  serializeSceneGraph,
  serializedSceneGraphTransferList
} from '#core/kiwi/fig/parse/transfer'
import { buildFigPopulationDelta, installFigMutationJournal } from '#core/kiwi/fig/population/delta'

interface WorkerParseRequest {
  buffer: ArrayBuffer
  options?: { populate?: 'all' | 'first-page' }
}
interface PopulateRequest {
  type: 'populate'
  requestId: string
  baseRevision: number
  pageId: string
}
type WorkerRequest = ArrayBuffer | WorkerParseRequest | PopulateRequest
type WorkerPostMessage = (message: unknown, transfer: Transferable[]) => void
const postWorkerMessage: WorkerPostMessage = (message, transfer) => {
  globalThis.postMessage(message, { transfer })
}
let graph: SceneGraph | undefined

function isPopulateRequest(request: WorkerRequest): request is PopulateRequest {
  return !(request instanceof ArrayBuffer) && 'type' in request
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (isPopulateRequest(request)) {
      if (!graph) throw new Error('FIG parse worker has no retained graph')
      const journal = installFigMutationJournal(graph)
      try {
        const populated = populateLazyFigImportRoots(graph, [request.pageId])
        const context = getLazyFigImportContext(graph)
        if (!context) throw new Error('FIG population worker has no lazy import context')
        postWorkerMessage(
          {
            type: 'population-result',
            requestId: request.requestId,
            baseRevision: request.baseRevision,
            populated,
            delta: buildFigPopulationDelta(graph, journal, context.populatedRootIds)
          },
          []
        )
      } finally {
        journal.stop()
      }
      return
    }
    const parseRequest: WorkerParseRequest =
      request instanceof ArrayBuffer ? { buffer: request } : request
    const { nodeChanges, blobs, images, figKiwiVersion, figSchemaDeflated } = parseFigBuffer(
      parseRequest.buffer
    )
    const parsedGraph = importNodeChanges(nodeChanges, blobs, new Map(images), parseRequest.options)
    parsedGraph.figKiwiVersion = figKiwiVersion
    parsedGraph.figSchemaDeflated = figSchemaDeflated
    graph = parseRequest.options?.populate === 'first-page' ? parsedGraph : undefined
    const serialized = serializeSceneGraph(parsedGraph)
    const transfer =
      parseRequest.options?.populate === 'first-page'
        ? []
        : serializedSceneGraphTransferList(serialized)
    postWorkerMessage({ graph: serialized }, transfer)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    postWorkerMessage(
      isPopulateRequest(request)
        ? { type: 'population-error', error: errorMessage }
        : { error: errorMessage },
      []
    )
  }
}
