import { loadFigDataDecompressor } from '@open-pencil/kiwi/fig/container'

import { serializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { applyFigGraphEdits } from '#core/kiwi/fig/population/edits'
import { createFigArchiveOperations } from '#core/kiwi/fig/session/archive/access'
import { sendStream } from '#core/kiwi/fig/session/port-stream'
import type {
  FigSessionLoadRequest,
  FigSessionOpenRequest,
  FigSessionRequest,
  FigSessionResponse
} from '#core/kiwi/fig/session/protocol'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

let session: ReturnType<typeof openReaderSession> | undefined
let archive: ReturnType<typeof createFigArchiveOperations> | undefined
let port: MessagePort | undefined

/** How often a page load reports that it is still advancing. */
const PROGRESS_INTERVAL_MS = 1000
/** New layers per piece of a page load: copying and applying one takes the main thread ~50 ms. */
const POPULATION_CHUNK_LAYERS = 1000

function respond(message: FigSessionResponse, transfer: Transferable[] = []): void {
  port?.postMessage(message, transfer)
}

function populate(request: FigSessionLoadRequest): void {
  if (!session) throw new Error('FIG session has no retained reader')
  const { requestId } = request
  let reportedAt = performance.now()
  const progress = () => {
    const now = performance.now()
    if (now - reportedAt < PROGRESS_INTERVAL_MS) return
    reportedAt = now
    respond({ type: 'population-progress', requestId })
  }
  const result =
    request.type === 'populate'
      ? session.populate(request.pageId, progress)
      : session.loadComponents(request.componentIds, progress)
  // Sent in pieces, so the main thread copies and applies a large page in tasks short enough
  // for the editor to keep responding between them.
  const { created, ...changes } = result.delta
  for (let start = 0; start < created.length; start += POPULATION_CHUNK_LAYERS) {
    respond({
      type: 'population-chunk',
      requestId,
      created: created.slice(start, start + POPULATION_CHUNK_LAYERS).map(([, node]) => node)
    })
  }
  respond({
    type: 'population-result',
    requestId,
    baseRevision: request.baseRevision,
    populated: result.populated,
    checkpoint: result.checkpoint,
    delta: { ...changes, created: [] }
  })
}

type ArchiveRequest = Extract<
  FigSessionRequest,
  {
    type: 'original-archive' | 'archive-info' | 'component-pages' | 'record-pages' | 'patch-archive'
  }
>

async function answerArchiveRequest(request: ArchiveRequest): Promise<void> {
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
    } else if (request.type === 'record-pages') {
      const pageIds = archive.recordPages(request.recordIds)
      respond({ type: 'record-pages-result', requestId, pageIds })
    } else {
      sendStream(await archive.patch(request.patch, request.input), request.port)
      respond({ type: 'patch-archive-result', requestId })
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
      request.type === 'record-pages' ||
      request.type === 'patch-archive'
    ) {
      void answerArchiveRequest(request)
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
    if (request.type === 'edits') {
      if (session) applyFigGraphEdits(session.graph, request.edits)
      return
    }
    populate(request)
  } catch (error) {
    respond({
      type: 'population-error',
      requestId:
        request.type === 'populate' || request.type === 'load-components'
          ? request.requestId
          : undefined,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

self.onmessage = async (event: MessageEvent<FigSessionOpenRequest>) => {
  const request = event.data
  port = request.port
  port.onmessage = (message: MessageEvent<FigSessionRequest>) => handleRequest(message.data)
  port.start()
  try {
    await loadFigDataDecompressor()
    const opened = openReaderSession(request.buffer, request.options?.populate)
    const archiveInfo = opened.session.archiveRecordInfo()
    archive = createFigArchiveOperations(request.buffer, () => archiveInfo)
    respond({ type: 'page-manifest', pages: opened.pages })
    const keepsSession =
      request.options?.populate === 'first-page' || request.options?.populate === 'none'
    session = keepsSession ? opened : undefined
    const mainThreadArchive = keepsSession ? request.buffer.slice(0) : undefined
    respond(
      {
        type: 'graph',
        graph: serializeSceneGraph(opened.graph),
        checkpoint: opened.checkpoint(),
        archiveInfo,
        archive: mainThreadArchive
      },
      mainThreadArchive ? [mainThreadArchive] : []
    )
  } catch (error) {
    respond({ type: 'graph', error: error instanceof Error ? error.message : String(error) })
  }
}
