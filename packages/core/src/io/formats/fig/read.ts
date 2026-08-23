import { parseFigBuffer } from '@open-pencil/fig'
import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { IS_BROWSER } from '#core/constants'
import { importNodeChanges } from '#core/kiwi/fig/import'
import { createFigParseWorker } from '#core/kiwi/fig/parse/client'
import { deserializeSceneGraph } from '#core/kiwi/fig/parse/transfer'
import type { SerializedSceneGraph } from '#core/kiwi/fig/parse/transfer'
import { registerFigPopulationWorker } from '#core/kiwi/fig/population/client'

export interface ParseFigFileOptions {
  populate?: 'all' | 'first-page' | 'none'
  onPages?: (pages: readonly FigPageManifestEntry[]) => void
}

function parseFigFileSync(buffer: ArrayBuffer, options: ParseFigFileOptions = {}): SceneGraph {
  const {
    nodeChanges,
    blobs,
    images: imageEntries,
    figKiwiVersion,
    figSchemaDeflated
  } = parseFigBuffer(buffer, options.onPages)
  const graph = importNodeChanges(nodeChanges, blobs, new Map(imageEntries), options)
  graph.figKiwiVersion = figKiwiVersion
  graph.figSchemaDeflated = figSchemaDeflated
  return graph
}

interface WorkerGraphResult {
  type: 'graph'
  graph?: SerializedSceneGraph
  error?: string
}

interface WorkerPageManifestResult {
  type: 'page-manifest'
  pages: FigPageManifestEntry[]
}

type WorkerParseResult = WorkerGraphResult | WorkerPageManifestResult

function parseViaWorker(buffer: ArrayBuffer, options: ParseFigFileOptions): Promise<SceneGraph> {
  return new Promise((resolve, reject) => {
    const worker = createFigParseWorker()

    worker.onmessage = (e: MessageEvent<WorkerParseResult>) => {
      if (e.data.type === 'page-manifest') {
        options.onPages?.(e.data.pages)
        return
      }
      if (e.data.error || !e.data.graph) {
        worker.terminate()
        reject(new Error(e.data.error ?? 'Worker failed to parse .fig file'))
        return
      }
      try {
        const graph = deserializeSceneGraph(e.data.graph)
        if (options.populate === 'first-page') {
          worker.onmessage = null
          worker.onerror = null
          registerFigPopulationWorker(graph, worker)
        } else worker.terminate()
        resolve(graph)
      } catch (error) {
        worker.terminate()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker failed to parse .fig file'))
    }

    worker.postMessage({ buffer, options: { populate: options.populate } }, [buffer])
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
