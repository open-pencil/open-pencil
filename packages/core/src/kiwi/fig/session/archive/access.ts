import {
  figArchiveComponentUsePages,
  figArchiveRecordPages,
  patchFigArchive,
  patchFigArchiveStream,
  type FigArchiveRecordInfo,
  type FigPatchedArchiveInput,
  type FigRecordPatch
} from '@open-pencil/fig'
import { loadFigDataCompressor } from '@open-pencil/kiwi/fig/container'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { randomHex } from '@open-pencil/scene-graph/random'

import type { FigSessionRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'

/**
 * The `.fig` archive a document was opened from, for writing the document back as that archive
 * with only its changed records replaced. In the browser the reader's worker holds the archive
 * and does this work; elsewhere, or once that worker is gone, it runs where it is asked.
 */
export type FigArchiveSink = (chunk: Uint8Array) => void | Promise<void>
export type FigArchiveProgress = (written: number, total: number) => void

export interface FigArchiveAccess {
  original(): Promise<Uint8Array>
  info(): Promise<FigArchiveRecordInfo>
  /** Archive GUIDs of the pages whose instances use these components. */
  componentPages(componentIds: string[]): Promise<string[]>
  /** The archive GUID of the page each record is on, `null` for one on no page. */
  recordPages(recordIds: string[]): Promise<(string | null)[]>
  patch(patch: FigRecordPatch, input: FigPatchedArchiveInput): Promise<Uint8Array>
  /** The patched archive written into `sink` chunk by chunk, never assembled whole. */
  patchStream(
    patch: FigRecordPatch,
    input: FigPatchedArchiveInput,
    sink: FigArchiveSink,
    onProgress?: FigArchiveProgress
  ): Promise<void>
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
    recordPages: (recordIds: string[]) =>
      figArchiveRecordPages(bytes, recordIds).map((pageId) => pageId ?? null),
    patch: async (patch: FigRecordPatch, input: FigPatchedArchiveInput) =>
      patchFigArchive(bytes, patch, input, await loadFigDataCompressor(input.compressionLevel)),
    patchStream: async (
      patch: FigRecordPatch,
      input: FigPatchedArchiveInput,
      sink: FigArchiveSink,
      onProgress?: FigArchiveProgress
    ) =>
      patchFigArchiveStream(
        bytes,
        patch,
        input,
        await loadFigDataCompressor(input.compressionLevel),
        sink,
        { onProgress }
      )
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
    recordPages: async (recordIds) => operations.recordPages(recordIds),
    patch: (patch, input) => operations.patch(patch, input),
    patchStream: (patch, input, sink, onProgress) =>
      operations.patchStream(patch, input, sink, onProgress),
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
      | 'record-pages-result'
      | 'patch-archive-result'
      | 'archive-error'
  }
>

const ARCHIVE_RESPONSES = new Set<FigSessionResponse['type']>([
  'original-archive-result',
  'archive-info-result',
  'component-pages-result',
  'record-pages-result',
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

interface StreamingRequest {
  sink: FigArchiveSink
  onProgress?: FigArchiveProgress
  resolve: () => void
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
  const streams = new Map<string, StreamingRequest>()
  let local: FigArchiveAccess | undefined
  let closed = false
  const toFallback = (): FigArchiveAccess => {
    if (local) return local
    const access = fallback()
    local = access
    worker.terminate()
    for (const waiting of pending.values()) waiting.retry(access)
    pending.clear()
    for (const stream of streams.values()) stream.reject(new Error('The archive worker stopped'))
    streams.clear()
    return access
  }
  worker.addEventListener('error', () => toFallback())
  port.addEventListener('message', (event: MessageEvent<FigSessionResponse>) => {
    const data = event.data
    if (data.type === 'patch-archive-chunk') {
      const stream = streams.get(data.requestId)
      if (!stream) return
      void (async () => {
        try {
          await stream.sink(data.bytes)
          port.postMessage({ type: 'patch-archive-ack', requestId: data.requestId, ok: true })
        } catch (error) {
          streams.delete(data.requestId)
          port.postMessage({ type: 'patch-archive-ack', requestId: data.requestId, ok: false })
          stream.reject(error instanceof Error ? error : new Error(String(error)))
        }
      })()
      return
    }
    if (data.type === 'patch-archive-progress') {
      streams.get(data.requestId)?.onProgress?.(data.written, data.total)
      return
    }
    if (data.type === 'patch-archive-done') {
      const stream = streams.get(data.requestId)
      if (!stream) return
      streams.delete(data.requestId)
      stream.resolve()
      return
    }
    if (data.type === 'archive-error' && streams.has(data.requestId)) {
      const stream = streams.get(data.requestId)
      streams.delete(data.requestId)
      stream?.reject(new Error(data.error))
      return
    }
    if (!ARCHIVE_RESPONSES.has(data.type)) return
    const response = data as ArchiveResponse
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
    recordPages: (recordIds) =>
      ask(
        { type: 'record-pages', recordIds },
        'record-pages-result',
        (response) => response.pageIds,
        (access) => access.recordPages(recordIds)
      ),
    patch: (patch, input) =>
      ask(
        { type: 'patch-archive', patch, input },
        'patch-archive-result',
        (response) => response.bytes,
        (access) => access.patch(patch, input)
      ),
    patchStream: (patch, input, sink, onProgress) => {
      if (closed) return Promise.reject(new Error('The document closed'))
      if (local) return local.patchStream(patch, input, sink, onProgress)
      return new Promise<void>((resolve, reject) => {
        const requestId = randomHex()
        streams.set(requestId, { sink, onProgress, resolve, reject })
        port.postMessage({ type: 'patch-archive-stream', requestId, patch, input })
      })
    },
    dropWorker: () => void toFallback(),
    close() {
      if (closed) return
      closed = true
      for (const waiting of pending.values()) waiting.reject(new Error('The document closed'))
      pending.clear()
      for (const stream of streams.values()) stream.reject(new Error('The document closed'))
      streams.clear()
      if (local) return
      port.postMessage({ type: 'dispose' })
      port.close()
      worker.terminate()
    }
  }
}
