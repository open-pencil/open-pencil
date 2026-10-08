import {
  figArchiveComponentUsePages,
  patchFigArchive,
  type FigArchiveRecordInfo,
  type FigPatchedArchiveInput,
  type FigRecordPatch
} from '@open-pencil/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { FigSessionRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'

/**
 * The `.fig` archive a document was opened from, for writing the document back as that archive
 * with only its changed records replaced. In the browser the reader's worker holds the archive
 * and does this work; elsewhere, or once that worker is gone, it runs where it is asked.
 */
export interface FigArchiveAccess {
  original(): Promise<Uint8Array>
  info(): Promise<FigArchiveRecordInfo>
  /** Archive GUIDs of the pages whose instances use these components. */
  componentPages(componentIds: string[]): Promise<string[]>
  patch(patch: FigRecordPatch, input: FigPatchedArchiveInput): Promise<Uint8Array>
  /** The document closed: release whatever holds the archive. */
  close(): void
}

const archives = new WeakMap<SceneGraph, FigArchiveAccess>()

export function registerFigArchive(graph: SceneGraph, archive: FigArchiveAccess): void {
  archives.set(graph, archive)
}

export function figArchive(graph: SceneGraph): FigArchiveAccess | undefined {
  return archives.get(graph)
}

export function releaseFigArchive(graph: SceneGraph): void {
  archives.get(graph)?.close()
  archives.delete(graph)
}

/**
 * The archive operations themselves, over bytes nothing else writes to. They read the archive
 * as bytes, so they outlive the reader session that opened it; only the record info comes from
 * that session, taken while its records are decoded.
 */
export function createFigArchiveOperations(bytes: ArrayBuffer, info: () => FigArchiveRecordInfo) {
  return {
    original: () => new Uint8Array(bytes.slice(0)),
    info,
    componentPages: (componentIds: string[]) => figArchiveComponentUsePages(bytes, componentIds),
    patch: (patch: FigRecordPatch, input: FigPatchedArchiveInput) =>
      patchFigArchive(bytes, patch, input)
  }
}

export function localFigArchive(
  bytes: ArrayBuffer,
  info: () => FigArchiveRecordInfo
): FigArchiveAccess {
  const operations = createFigArchiveOperations(bytes, info)
  return {
    original: async () => operations.original(),
    info: async () => operations.info(),
    componentPages: async (componentIds) => operations.componentPages(componentIds),
    patch: async (patch, input) => operations.patch(patch, input),
    close: () => undefined
  }
}

type ArchiveResponse = Extract<
  FigSessionResponse,
  {
    type:
      | 'original-archive-result'
      | 'archive-info-result'
      | 'component-pages-result'
      | 'patch-archive-result'
      | 'archive-error'
  }
>

const ARCHIVE_RESPONSES = new Set<FigSessionResponse['type']>([
  'original-archive-result',
  'archive-info-result',
  'component-pages-result',
  'patch-archive-result',
  'archive-error'
])

type ArchivePort = Pick<MessagePort, 'postMessage' | 'addEventListener' | 'close'>
type ArchiveWorker = Pick<Worker, 'terminate' | 'addEventListener'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export interface WorkerFigArchiveAccess extends FigArchiveAccess {
  /** Stop the worker now, as an abandoned page load does; requests continue on the fallback. */
  dropWorker(): void
}

interface WaitingRequest {
  retry: (access: FigArchiveAccess) => void
  resolve: (response: ArchiveResponse) => void
  reject: (error: Error) => void
}

/**
 * Archive operations answered by the reader's worker over its session port. The worker serves
 * the archive until the document closes, even after it stops loading pages. If it fails or is
 * stopped, requests, those waiting included, run on the fallback instead.
 */
export function workerFigArchive(
  port: ArchivePort,
  worker: ArchiveWorker,
  fallback: () => FigArchiveAccess
): WorkerFigArchiveAccess {
  const pending = new Map<string, WaitingRequest>()
  let local: FigArchiveAccess | undefined
  let closed = false
  const toFallback = (): FigArchiveAccess => {
    if (local) return local
    const access = fallback()
    local = access
    worker.terminate()
    for (const waiting of pending.values()) waiting.retry(access)
    pending.clear()
    return access
  }
  worker.addEventListener('error', () => toFallback())
  port.addEventListener('message', (event: MessageEvent<FigSessionResponse>) => {
    if (!ARCHIVE_RESPONSES.has(event.data.type)) return
    const response = event.data as ArchiveResponse
    const waiting = pending.get(response.requestId)
    if (!waiting) return
    pending.delete(response.requestId)
    if (response.type === 'archive-error') waiting.reject(new Error(response.error))
    else waiting.resolve(response)
  })
  const ask = <T extends ArchiveResponse['type'], Result>(
    message: DistributiveOmit<FigSessionRequest, 'requestId'>,
    type: T,
    read: (response: Extract<ArchiveResponse, { type: T }>) => Result,
    onFallback: (access: FigArchiveAccess) => Promise<Result>
  ): Promise<Result> => {
    if (closed) return Promise.reject(new Error('The document closed'))
    if (local) return onFallback(local)
    return new Promise<Result>((resolve, reject) => {
      const requestId = randomHex()
      pending.set(requestId, {
        retry: (access) => void onFallback(access).then(resolve, reject),
        resolve: (response) => {
          if (response.type === type)
            resolve(read(response as Extract<ArchiveResponse, { type: T }>))
          else reject(new Error(`Unexpected ${response.type} for ${message.type}`))
        },
        reject
      })
      port.postMessage({ ...message, requestId })
    })
  }
  return {
    original: () =>
      ask(
        { type: 'original-archive' },
        'original-archive-result',
        (response) => response.bytes,
        (access) => access.original()
      ),
    info: () =>
      ask(
        { type: 'archive-info' },
        'archive-info-result',
        (response) => response.info,
        (access) => access.info()
      ),
    componentPages: (componentIds) =>
      ask(
        { type: 'component-pages', componentIds },
        'component-pages-result',
        (response) => response.pageIds,
        (access) => access.componentPages(componentIds)
      ),
    patch: (patch, input) =>
      ask(
        { type: 'patch-archive', patch, input },
        'patch-archive-result',
        (response) => response.bytes,
        (access) => access.patch(patch, input)
      ),
    dropWorker: () => void toFallback(),
    close() {
      if (closed) return
      closed = true
      for (const waiting of pending.values()) waiting.reject(new Error('The document closed'))
      pending.clear()
      if (local) return
      port.postMessage({ type: 'dispose' })
      port.close()
      worker.terminate()
    }
  }
}
