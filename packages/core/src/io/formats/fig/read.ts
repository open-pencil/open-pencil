import { IS_BROWSER } from '#core/constants'
import { importNodeChanges } from '#core/kiwi/fig/import'
import { parseFigBuffer } from '#core/kiwi/fig/parse/core'
import { deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'

import type { SerializedSceneGraph } from '#core/kiwi/fig/parse/transfer'
import type { SceneGraph } from '#core/scene-graph'

export interface ParseFigFileOptions {
  populate?: 'all' | 'first-page'
}

function parseFigFileSync(buffer: ArrayBuffer, options: ParseFigFileOptions = {}): SceneGraph {
  const { nodeChanges, blobs, images: imageEntries, figKiwiVersion } = parseFigBuffer(buffer)
  const graph = importNodeChanges(nodeChanges, blobs, new Map(imageEntries), options)
  graph.figKiwiVersion = figKiwiVersion
  return graph
}

interface WorkerParseResult {
  graph?: SerializedSceneGraph
  error?: string
}

function parseViaWorker(buffer: ArrayBuffer, options: ParseFigFileOptions): Promise<SceneGraph> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../../kiwi/fig/parse/worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (e: MessageEvent<WorkerParseResult>) => {
      worker.terminate()
      if (e.data.error || !e.data.graph) {
        reject(new Error(e.data.error ?? 'Worker failed to parse .fig file'))
        return
      }
      resolve(deserializeSceneGraph(e.data.graph))
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker failed to parse .fig file'))
    }

    worker.postMessage({ buffer, options }, [buffer])
  })
}

export async function parseFigFile(
  buffer: ArrayBuffer,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  if (typeof Worker !== 'undefined' && IS_BROWSER) {
    const copy = buffer.slice(0)
    try {
      return await parseViaWorker(buffer, options)
    } catch (error) {
      console.warn('Worker parsing failed, falling back to main thread:', error)
      return parseFigFileSync(copy, options)
    }
  }
  return parseFigFileSync(buffer, options)
}

export async function readFigFile(
  file: File,
  options: ParseFigFileOptions = {}
): Promise<SceneGraph> {
  return parseFigFile(await file.arrayBuffer(), options)
}
