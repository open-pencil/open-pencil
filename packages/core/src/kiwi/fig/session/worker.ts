import { serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { createFigArchiveOperations } from '#core/kiwi/fig/session/archive'
import type {
  FigSessionOpenRequest,
  FigSessionRequest,
  FigSessionResponse
} from '#core/kiwi/fig/session/protocol'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

let session: ReturnType<typeof openReaderSession> | undefined
let archive: ReturnType<typeof createFigArchiveOperations> | undefined
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

type ArchiveRequest = Extract<
  FigSessionRequest,
  { type: 'original-archive' | 'archive-info' | 'component-pages' | 'patch-archive' }
>

function answerArchiveRequest(request: ArchiveRequest): void {
  const { requestId } = request
  try {
    if (!archive) throw new Error('FIG session has no original archive')
    if (request.type === 'original-archive') {
      const bytes = archive.original()
      port?.postMessage({ type: 'original-archive-result', requestId, bytes }, [bytes.buffer])
    } else if (request.type === 'archive-info') {
      respond({ type: 'archive-info-result', requestId, info: archive.info() })
    } else if (request.type === 'component-pages') {
      const pageIds = archive.componentPages(request.componentIds)
      respond({ type: 'component-pages-result', requestId, pageIds })
    } else {
      const bytes = archive.patch(request.patch, request.input)
      port?.postMessage({ type: 'patch-archive-result', requestId, bytes }, [bytes.buffer])
    }
  } catch (error) {
    respond({
      type: 'archive-error',
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

function handleRequest(request: FigSessionRequest): void {
  try {
    if (
      request.type === 'original-archive' ||
      request.type === 'archive-info' ||
      request.type === 'component-pages' ||
      request.type === 'patch-archive'
    ) {
      answerArchiveRequest(request)
      return
    }
    if (request.type === 'dispose') {
      session = undefined
      archive = undefined
      respond({ type: 'disposed' })
      port?.close()
      port = undefined
      self.close()
      return
    }
    if (request.type === 'cancel') return
    if (request.type === 'retire') {
      session = undefined
      return
    }
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
  // The worker copies the archive itself, so the main thread sends the file once.
  const archiveBytes = request.buffer.slice(0)
  try {
    const opened = openReaderSession(request.buffer, request.options?.populate)
    const archiveInfo = opened.session.archiveRecordInfo()
    archive = createFigArchiveOperations(archiveBytes, () => archiveInfo)
    respond({ type: 'page-manifest', pages: opened.pages })
    session =
      request.options?.populate === 'first-page' || request.options?.populate === 'none'
        ? opened
        : undefined
    respond({
      type: 'graph',
      graph: serializeSceneGraph(opened.graph),
      checkpoint: opened.checkpoint(),
      archiveInfo
    })
  } catch (error) {
    respond({ type: 'graph', error: error instanceof Error ? error.message : String(error) })
  }
}
