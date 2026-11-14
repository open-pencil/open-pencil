import type { SceneGraph } from '@open-pencil/scene-graph'
import { randomHex } from '@open-pencil/scene-graph/random'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'
import { archiveChanges, trackArchiveChanges } from '#core/kiwi/fig/session/archive/changes'
import { updateReaderRecovery, releaseReaderRecovery } from '#core/kiwi/fig/session/document-state'
import type { FigSessionRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'

import { applyFigPopulationDelta, type FigPopulationRebase } from './delta'
import { trackFigGraphEdits } from './edits'

/** The responses this client acts on, taken from the session protocol itself. */
type WorkerResult = Extract<
  FigSessionResponse,
  { type: 'population-result' | 'population-error' | 'population-progress' }
>

const MAX_FIG_POPULATION_WORKER_NODES = 200_000
/**
 * How long a page load may go without reporting progress before the worker counts as stuck. A
 * large page legitimately takes longer than this; it reports progress as it goes.
 */
const FIG_POPULATION_WORKER_STALL_MS = 30_000
const populationWorkers = new WeakMap<SceneGraph, FigPopulationWorker>()
interface OriginalArchiveRequest {
  request: () => Promise<Uint8Array>
  valid: boolean
  unbind: () => void
}
const originalArchiveRequests = new WeakMap<SceneGraph, OriginalArchiveRequest>()

export interface FigPopulationWorkerTelemetry {
  event: 'registered' | 'populate' | 'fallback' | 'stale' | 'terminated'
  reason?: 'oversized' | 'graph-mutation' | 'worker-error'
  durationMs?: number
  applyMs?: number
  created?: number
  updated?: number
  deleted?: number
}

function emitTelemetry(detail: FigPopulationWorkerTelemetry): void {
  if (typeof globalThis.dispatchEvent !== 'function') return
  globalThis.dispatchEvent(new CustomEvent('openpencil:fig-population-worker', { detail }))
}

export function registerFigPopulationWorker(
  graph: SceneGraph,
  worker: Worker,
  port?: MessagePort,
  stopWorker?: () => void
): void {
  if (graph.nodes.size > MAX_FIG_POPULATION_WORKER_NODES) {
    emitTelemetry({ event: 'fallback', reason: 'oversized' })
    if (!port) {
      worker.terminate()
      return
    }
    populationWorkers.set(graph, createRetiredWorker(worker, port, stopWorker))
    return
  }
  const client = createPopulationWorkerClient(graph, worker, port, stopWorker)
  populationWorkers.set(graph, client)
  emitTelemetry({ event: 'registered' })
}

export function canUseFigPopulationWorker(graph: SceneGraph): boolean {
  return populationWorkers.has(graph)
}

export function registerOriginalArchiveRequest(
  graph: SceneGraph,
  request: () => Promise<Uint8Array>
): void {
  const entry: OriginalArchiveRequest = { request, valid: true, unbind: () => undefined }
  // Layout and the layers a page loads from this archive leave it describing the document.
  const invalidate = () => {
    if (!graph.isApplyingLayout && !graph.isApplyingImportedState) entry.valid = false
  }
  entry.unbind = graph.onNodeEvents({
    created: invalidate,
    updated: invalidate,
    deleted: invalidate,
    reparented: invalidate,
    reordered: invalidate
  })
  originalArchiveRequests.set(graph, entry)
  trackArchiveChanges(graph)
}

/** Variables and document settings change without layer events. */
function divergedOutsideLayers(graph: SceneGraph): boolean {
  const changes = archiveChanges(graph)
  return (
    !!changes &&
    (changes.changedVariables.size > 0 || changes.collectionsChanged || changes.documentChanged)
  )
}

export async function requestOriginalArchive(graph: SceneGraph): Promise<Uint8Array | null> {
  const entry = originalArchiveRequests.get(graph)
  if (!entry?.valid || divergedOutsideLayers(graph)) return null
  const archive = await entry.request()
  return originalArchiveRequests.get(graph)?.valid === true &&
    originalArchiveRequests.get(graph) === entry
    ? archive
    : null
}

/**
 * Stops the reader worker a document opened with, as an abandoned page load does: the document
 * then loads its pages and writes its archive on this thread, from the copy it keeps. A reload
 * calls this before reading the file again, since a large document does not fit in a page twice.
 */
export function stopFigReaderWorker(graph: SceneGraph): void {
  populationWorkers.get(graph)?.stop()
  populationWorkers.delete(graph)
}

export function releaseFigPopulationWorker(graph: SceneGraph): void {
  releaseReaderRecovery(graph)
  populationWorkers.get(graph)?.terminate()
  populationWorkers.delete(graph)
  originalArchiveRequests.get(graph)?.unbind()
  originalArchiveRequests.delete(graph)
  releaseFigArchive(graph)
}

export interface FigPopulationWorker {
  populate: (pageId: string, signal?: AbortSignal) => Promise<boolean | null>
  /**
   * Stop loading pages through the worker. The worker itself keeps serving the document's
   * archive until the document closes, which releases it with the archive.
   */
  terminate: () => void
  /** Stop the worker itself: the archive carries on from this thread's copy. */
  stop: () => void
}

/** A worker too large to load pages through; one nothing else holds is disposed with it. */
function createRetiredWorker(
  worker: Worker,
  port: MessagePort,
  stopWorker?: () => void
): FigPopulationWorker {
  const sharedWorker = !!stopWorker
  if (sharedWorker) port.postMessage({ type: 'retire' })
  let disposed = false
  const terminate = () => {
    if (disposed || sharedWorker) return
    disposed = true
    emitTelemetry({ event: 'terminated' })
    port.postMessage({ type: 'dispose' })
    port.close()
    worker.terminate()
  }
  return {
    populate: () => Promise.resolve(null),
    // A worker that also serves the archive stops through the archive, which carries on without it.
    stop: () => (stopWorker ? stopWorker() : terminate()),
    terminate
  }
}

export function createFigPopulationWorker(graph: SceneGraph): FigPopulationWorker | null {
  if (!canUseFigPopulationWorker(graph)) return null
  return populationWorkers.get(graph) ?? null
}

/**
 * The client owns the worker unless `stopWorker` is given: a document whose archive the worker
 * also holds passes the archive's, so that retiring page loading leaves the worker serving it
 * and stopping the worker lets the archive carry on without it.
 */
export function createPopulationWorkerClient(
  graph: SceneGraph,
  worker: Pick<Worker, 'postMessage' | 'terminate' | 'onerror' | 'onmessage'>,
  port?: Pick<MessagePort, 'postMessage' | 'start' | 'close' | 'onmessage'>,
  stopWorker?: () => void
): FigPopulationWorker {
  const sharedWorker = !!stopWorker
  const stopWorkerNow = stopWorker ?? (() => worker.terminate())
  const pending = new Map<
    string,
    {
      resolve: (value: boolean | null) => void
      abort?: () => void
      revision: number
      startedAt: number
      timeout: ReturnType<typeof setTimeout>
    }
  >()
  let stale = false
  let disposed = false
  /** Answer every load in flight with null, so its page loads on the main thread instead. */
  const settlePending = () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout)
      request.abort?.()
      request.resolve(null)
    }
    pending.clear()
  }
  const post = (message: FigSessionRequest) => {
    if (port) port.postMessage(message)
    else worker.postMessage(message, [])
  }
  // Edits reach the worker's copy of the graph, so pages keep loading there once it is edited.
  const edits = trackFigGraphEdits(graph, (batch) => {
    post({ type: 'edits', edits: batch })
    forgetSettledEdits(batch.revision)
  })
  /** Batches up to the oldest load in flight, or all of them with none, are not needed. */
  const forgetSettledEdits = (newest: number) => {
    let oldest = newest
    for (const request of pending.values()) oldest = Math.min(oldest, request.revision)
    edits.forget(oldest)
  }
  const releaseSubscription = () => edits.stop()
  /**
   * Stop loading pages here. A load the worker reports failing only retires its session, so the
   * worker keeps serving the archive; a stuck or crashed worker is stopped.
   */
  const fail = (emit = true, stop = true) => {
    stale = true
    if (emit) emitTelemetry({ event: 'fallback', reason: 'worker-error' })
    settlePending()
    releaseSubscription()
    if (stop || !sharedWorker) stopWorkerNow()
    else port?.postMessage({ type: 'retire' })
    populationWorkers.delete(graph)
  }
  const watchForStall = () => setTimeout(() => fail(), FIG_POPULATION_WORKER_STALL_MS)
  const receive = (result: WorkerResult) => {
    if (result.type === 'population-error') return fail(true, false)
    if (result.type === 'population-progress') {
      const request = pending.get(result.requestId)
      if (!request) return
      clearTimeout(request.timeout)
      request.timeout = watchForStall()
      return
    }
    const request = pending.get(result.requestId)
    if (!request) return
    clearTimeout(request.timeout)
    request.abort?.()
    if (stale || result.baseRevision !== request.revision) {
      pending.delete(result.requestId)
      emitTelemetry({ event: 'stale', reason: 'graph-mutation' })
      return request.resolve(null)
    }
    const applyStartedAt = performance.now()
    let rebase: FigPopulationRebase
    try {
      // Edits not sent yet are among those the worker did not see. The load stays pending until
      // they are read, so sending them keeps the batches it needs.
      edits.flush()
      const edited = edits.changedSince(request.revision)
      pending.delete(result.requestId)
      // The page arrives from outside any edit open now, such as a script's awaiting tool call,
      // so no undo step takes it in.
      rebase = graph.runOutsideEdits(() =>
        edits.ignoring(() => applyFigPopulationDelta(graph, result.delta, edited))
      )
      if (result.checkpoint) updateReaderRecovery(graph, result.checkpoint)
    } catch {
      pending.delete(result.requestId)
      fail()
      return request.resolve(null)
    }
    forgetSettledEdits(edits.revision)
    // The worker built what it sent without the edits made meanwhile; it takes this thread's
    // state where they met, and the instances it built from components edited since.
    edits.send(rebase.diverged)
    graph.runOutsideEdits(() => {
      for (const id of rebase.staleInstances) graph.syncInstance(id)
    })
    request.resolve(result.populated)
    emitTelemetry({
      event: 'populate',
      durationMs: performance.now() - request.startedAt,
      applyMs: performance.now() - applyStartedAt,
      created: result.delta.created.length,
      updated: result.delta.updated.length,
      deleted: result.delta.deleted.length
    })
  }
  if (port) {
    port.onmessage = (event: MessageEvent<WorkerResult>) => receive(event.data)
    port.start()
  } else {
    worker.onmessage = (event: MessageEvent<WorkerResult>) => receive(event.data)
  }
  worker.onerror = () => fail()
  return {
    populate(pageId, signal) {
      signal?.throwIfAborted()
      if (stale) return Promise.resolve(null)
      const requestId = randomHex()
      // Sent first, so the worker loads the page into a graph with every edit made so far.
      const baseRevision = edits.revision
      return new Promise((resolve, reject) => {
        const abort = () => {
          const request = pending.get(requestId)
          if (!request) return
          // The worker loads the page into its copy all the same. Its layers still apply here
          // when they arrive, so both graphs stay alike and later pages keep loading there.
          request.resolve = () => undefined
          reject(new DOMException('Aborted', 'AbortError'))
        }
        signal?.addEventListener('abort', abort, { once: true })
        pending.set(requestId, {
          resolve,
          abort: () => signal?.removeEventListener('abort', abort),
          revision: baseRevision,
          startedAt: performance.now(),
          timeout: watchForStall()
        })
        post({ type: 'populate', requestId, baseRevision, pageId })
      })
    },
    stop() {
      if (disposed) return
      disposed = true
      emitTelemetry({ event: 'terminated' })
      fail(false, true)
    },
    terminate() {
      if (disposed) return
      disposed = true
      emitTelemetry({ event: 'terminated' })
      if (!sharedWorker) {
        port?.postMessage({ type: 'dispose' })
        port?.close()
      }
      fail(false, false)
    }
  }
}
