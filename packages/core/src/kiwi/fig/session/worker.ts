import { serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import type {
  FigSessionOpenRequest,
  FigSessionRequest,
  FigSessionResponse
} from '#core/kiwi/fig/session/protocol'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

let session: ReturnType<typeof openReaderSession> | undefined
let originalArchive: Uint8Array | undefined
let port: MessagePort | undefined

function respond(message: FigSessionResponse): void {
  port?.postMessage(message)
}

function populate(request: Extract<FigSessionRequest, { type: 'populate' }>): void {
  if (!session) throw new Error('FIG session has no retained reader')
  const result = session.populate(request.pageId)
  respond({
    type: 'population-result',
    requestId: request.requestId,
    baseRevision: request.baseRevision,
    ...result
  })
}

function handleRequest(request: FigSessionRequest): void {
  try {
    if (request.type === 'original-archive') {
      if (!originalArchive) throw new Error('FIG session has no original archive')
      const bytes = originalArchive.slice()
      port?.postMessage({ type: 'original-archive-result', requestId: request.requestId, bytes }, [
        bytes.buffer
      ])
      return
    }
    if (request.type === 'dispose') {
      session = undefined
      originalArchive = undefined
      respond({ type: 'disposed' })
      port?.close()
      port = undefined
      self.close()
      return
    }
    if (request.type === 'cancel') return
    populate(request)
  } catch (error) {
    respond({
      type: 'population-error',
      requestId: request.type === 'populate' ? request.requestId : undefined,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

self.onmessage = (event: MessageEvent<FigSessionOpenRequest>) => {
  const request = event.data
  port = request.port
  port.onmessage = (message: MessageEvent<FigSessionRequest>) => handleRequest(message.data)
  port.start()
  originalArchive = new Uint8Array(request.archiveBuffer)
  try {
    const opened = openReaderSession(request.originalBuffer, request.options?.populate)
    respond({ type: 'page-manifest', pages: opened.pages })
    session = request.options?.populate === 'first-page' ? opened : undefined
    respond({
      type: 'graph',
      graph: serializeSceneGraph(opened.graph),
      checkpoint: opened.checkpoint()
    })
  } catch (error) {
    respond({ type: 'graph', error: error instanceof Error ? error.message : String(error) })
  }
}
