import type { FigSessionCheckpoint } from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { getLazyFigImportContext } from '#core/kiwi/fig/lazy-import'
import type { FigSessionResponse } from '#core/kiwi/fig/session/protocol'
import { updateReaderRecovery, releaseReaderRecovery } from '#core/kiwi/fig/session/recovery'
import { randomHex } from '#core/random'

import { applyFigPopulationDelta, type FigPopulationDelta } from './delta'

interface PopulationResult {
  type: 'population-result'
  requestId: string
  baseRevision: number
  populated: boolean
  checkpoint?: FigSessionCheckpoint
  delta: FigPopulationDelta
}
type WorkerResult = PopulationResult | { type: 'population-error'; error: string }

const MAX_FIG_POPULATION_WORKER_NODES = 200_000
const FIG_POPULATION_WORKER_TIMEOUT_MS = 30_000
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

const replacementGraphs = new WeakSet<SceneGraph>()

export function requiresFigReaderSession(graph: SceneGraph): boolean {
  return replacementGraphs.has(graph)
}

export function registerFigPopulationWorker(
  graph: SceneGraph,
  worker: Worker,
  port?: MessagePort,
  replacementReader = false
): void {
  if (replacementReader) replacementGraphs.add(graph)
  if (graph.nodes.size > MAX_FIG_POPULATION_WORKER_NODES) {
    emitTelemetry({ event: 'fallback', reason: 'oversized' })
    if (!port) {
      worker.terminate()
      return
    }
    populationWorkers.set(graph, createDisposalOnlyWorker(worker, port))
    return
  }
  const client = createPopulationWorkerClient(graph, worker, port)
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
  const invalidate = () => {
    if (!graph.isApplyingLayout) entry.valid = false
  }
  entry.unbind = graph.onNodeEvents({
    created: invalidate,
    updated: invalidate,
    deleted: invalidate,
    reparented: invalidate,
    reordered: invalidate
  })
  originalArchiveRequests.set(graph, entry)
}

export async function requestOriginalArchive(graph: SceneGraph): Promise<Uint8Array | null> {
  const entry = originalArchiveRequests.get(graph)
  if (!entry?.valid) return null
  const archive = await entry.request()
  return originalArchiveRequests.get(graph)?.valid === true &&
    originalArchiveRequests.get(graph) === entry
    ? archive
    : null
}

export function releaseFigPopulationWorker(graph: SceneGraph): void {
  releaseReaderRecovery(graph)
  replacementGraphs.delete(graph)
  populationWorkers.get(graph)?.terminate()
  populationWorkers.delete(graph)
  originalArchiveRequests.get(graph)?.unbind()
  originalArchiveRequests.delete(graph)
}

export interface FigPopulationWorker {
  populate: (pageId: string, signal?: AbortSignal) => Promise<boolean | null>
  terminate: () => void
}

function createDisposalOnlyWorker(worker: Worker, port: MessagePort): FigPopulationWorker {
  let disposed = false
  return {
    populate: () => Promise.resolve(null),
    terminate() {
      if (disposed) return
      disposed = true
      emitTelemetry({ event: 'terminated' })
      port.postMessage({ type: 'dispose' })
      port.close()
      worker.terminate()
    }
  }
}

export function createFigPopulationWorker(graph: SceneGraph): FigPopulationWorker | null {
  if (!canUseFigPopulationWorker(graph)) return null
  return populationWorkers.get(graph) ?? null
}

export function createPopulationWorkerClient(
  graph: SceneGraph,
  worker: Pick<Worker, 'postMessage' | 'terminate' | 'onerror' | 'onmessage'>,
  port?: Pick<MessagePort, 'postMessage' | 'start' | 'close' | 'onmessage'>
): FigPopulationWorker {
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
  let revision = 0
  let stale = false
  let disposed = false
  let applyingDelta = false
  const invalidate = () => {
    // Layout recomputation (import-time or after a switch) is derived from the
    // same scene graph the worker deltas were built from; it must not count as
    // user divergence. Only real user edits invalidate the worker.
    if (applyingDelta || stale || graph.isApplyingLayout) return
    revision++
    stale = true
    emitTelemetry({ event: 'stale', reason: 'graph-mutation' })
  }
  let unbind: (() => void) | undefined
  const releaseSubscription = () => {
    unbind?.()
    unbind = undefined
  }
  const fail = (emit = true) => {
    stale = true
    if (emit) emitTelemetry({ event: 'fallback', reason: 'worker-error' })
    for (const request of pending.values()) {
      clearTimeout(request.timeout)
      request.abort?.()
      request.resolve(null)
    }
    pending.clear()
    releaseSubscription()
    worker.terminate()
    populationWorkers.delete(graph)
  }
  unbind = graph.onNodeEvents({
    created: invalidate,
    updated: invalidate,
    deleted: invalidate,
    reparented: invalidate,
    reordered: invalidate
  })
  const receive = (result: WorkerResult) => {
    if (result.type === 'population-error') return fail()
    const request = pending.get(result.requestId)
    if (!request) return
    clearTimeout(request.timeout)
    request.abort?.()
    pending.delete(result.requestId)
    if (stale || revision !== request.revision || result.baseRevision !== request.revision) {
      emitTelemetry({ event: 'stale', reason: 'graph-mutation' })
      return request.resolve(null)
    }
    applyingDelta = true
    const applyStartedAt = performance.now()
    try {
      applyFigPopulationDelta(graph, result.delta)
      if (result.checkpoint) updateReaderRecovery(graph, result.checkpoint)
      const context = getLazyFigImportContext(graph)
      if (context) context.populatedRootIds = new Set(result.delta.populatedRootIds)
    } catch {
      applyingDelta = false
      fail()
      return request.resolve(null)
    } finally {
      applyingDelta = false
    }
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
    port.onmessage = (event: MessageEvent<FigSessionResponse>) =>
      receive(event.data as WorkerResult)
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
      const baseRevision = revision
      return new Promise((resolve, reject) => {
        const abort = () => {
          const request = pending.get(requestId)
          if (!request) return
          clearTimeout(request.timeout)
          pending.delete(requestId)
          fail(false)
          reject(new DOMException('Aborted', 'AbortError'))
        }
        signal?.addEventListener('abort', abort, { once: true })
        const timeout = setTimeout(() => fail(), FIG_POPULATION_WORKER_TIMEOUT_MS)
        pending.set(requestId, {
          resolve,
          abort: () => signal?.removeEventListener('abort', abort),
          revision: baseRevision,
          startedAt: performance.now(),
          timeout
        })
        if (port) port.postMessage({ type: 'populate', requestId, baseRevision, pageId })
        else worker.postMessage({ type: 'populate', requestId, baseRevision, pageId }, [])
      })
    },
    terminate() {
      if (disposed) return
      disposed = true
      emitTelemetry({ event: 'terminated' })
      port?.postMessage({ type: 'dispose' })
      port?.close()
      fail(false)
    }
  }
}
