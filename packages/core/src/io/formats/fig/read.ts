import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { IS_BROWSER } from '#core/constants'
import { deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import {
  registerFigPopulationWorker,
  registerOriginalArchiveRequest
} from '#core/kiwi/fig/population/client'
import {
  localFigArchive,
  registerFigArchive,
  workerFigArchive
} from '#core/kiwi/fig/session/archive'
import { createFigSessionWorker } from '#core/kiwi/fig/session/client'
import {
  registerReaderRecovery,
  registerReaderSession
} from '#core/kiwi/fig/session/document-state'
import type { FigSessionOpenRequest, FigSessionResponse } from '#core/kiwi/fig/session/protocol'
import { openReaderSession } from '#core/kiwi/fig/session/reader'

export interface ParseFigFileOptions {
  populate?: 'all' | 'first-page' | 'none'
  onPages?: (pages: readonly FigPageManifestEntry[]) => void
  signal?: AbortSignal
}

class ReaderSemanticError extends Error {
  override name = 'ReaderSemanticError'
}

function parseFigFileSync(buffer: ArrayBuffer, options: ParseFigFileOptions = {}): SceneGraph {
  options.signal?.throwIfAborted()
  const reader = openReaderSession(buffer, options.populate)
  options.onPages?.(reader.pages)
  options.signal?.throwIfAborted()
  const bytes = buffer.slice(0)
  registerReaderSession(bytes, reader.session, reader.diagnostics)
  // Taken now, while the records are decoded: the archive outlives the reader's session.
  const archiveInfo = reader.session.archiveRecordInfo()
  const archive = localFigArchive(bytes, () => archiveInfo)
  registerFigArchive(reader.graph, archive)
  registerOriginalArchiveRequest(reader.graph, () => archive.original())
  return reader.graph
}

export function parseFigFileViaWorker(
  buffer: ArrayBuffer,
  options: ParseFigFileOptions
): Promise<SceneGraph> {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted()
    const worker = createFigSessionWorker()
    const channel = new MessageChannel()
    const abort = () => {
      channel.port1.postMessage({ type: 'dispose' })
      channel.port1.close()
      worker.terminate()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    const cleanupAbort = () => options.signal?.removeEventListener('abort', abort)

    channel.port1.onmessage = (e: MessageEvent<FigSessionResponse>) => {
      if (e.data.type === 'page-manifest') {
        options.onPages?.(e.data.pages)
        return
      }
      if (e.data.type !== 'graph') return
      if (e.data.error || !e.data.graph) {
        cleanupAbort()
        channel.port1.close()
        worker.terminate()
        reject(new ReaderSemanticError(e.data.error ?? 'Worker failed to parse .fig file'))
        return
      }
      try {
        const graph = deserializeSceneGraph(e.data.graph)
        if (options.populate === 'first-page' || options.populate === 'none') {
          cleanupAbort()
          const { checkpoint, archiveInfo } = e.data
          if (!checkpoint || !archiveInfo) throw new Error('Missing reader checkpoint')
          const bytes = buffer.slice(0)
          registerReaderRecovery(graph, bytes, checkpoint)
          // The worker writes the archive back; without it the main thread does, from its copy.
          const archive = workerFigArchive(channel.port1, worker, () =>
            localFigArchive(bytes, () => archiveInfo)
          )
          registerFigPopulationWorker(graph, worker, channel.port1, () => archive.dropWorker())
          registerFigArchive(graph, archive)
          registerOriginalArchiveRequest(graph, () => archive.original())
        } else {
          cleanupAbort()
          channel.port1.close()
          worker.terminate()
        }
        resolve(graph)
      } catch (error) {
        cleanupAbort()
        channel.port1.close()
        worker.terminate()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    channel.port1.start()
    worker.onerror = (err) => {
      cleanupAbort()
      channel.port1.close()
      worker.terminate()
      reject(new Error(err.message || 'Worker failed to parse .fig file'))
    }
    const workerBuffer = buffer.slice(0)
    const request: FigSessionOpenRequest = {
      type: 'open',
      buffer: workerBuffer,
      options: { populate: options.populate },
      port: channel.port2
    }
    worker.postMessage(request, [workerBuffer, channel.port2])
  })
}

export async function parseFigFile(
  buffer: ArrayBuffer,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  options.signal?.throwIfAborted()
  if (typeof Worker !== 'undefined' && IS_BROWSER) {
    try {
      // The worker gets its own copy, so `buffer` is still whole for the fallback.
      return await parseFigFileViaWorker(buffer, options)
    } catch (error) {
      if (options.signal?.aborted || error instanceof ReaderSemanticError) throw error
      console.warn('Worker parsing failed, falling back to main thread:', error)
      return parseFigFileSync(buffer, options)
    }
  }
  options.signal?.throwIfAborted()
  return parseFigFileSync(buffer, options)
}

export async function readFigFile(
  file: File,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  options.signal?.throwIfAborted()
  const buffer = await file.arrayBuffer()
  options.signal?.throwIfAborted()
  return parseFigFile(buffer, options)
}
