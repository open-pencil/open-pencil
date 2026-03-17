import { IS_BROWSER } from '../constants'
import { importNodeChanges } from './fig-import'
import { parseFigBuffer } from './fig-parse-core'

import type { SceneGraph } from '../scene-graph'
import type { FigParseResult } from './fig-parse-core'

function parseFigFileSync(buffer: ArrayBuffer): SceneGraph {
  const { nodeChanges, blobs, images: imageEntries } = parseFigBuffer(buffer)
  return importNodeChanges(nodeChanges, blobs, new Map(imageEntries))
}

function parseViaWorker(buffer: ArrayBuffer): Promise<SceneGraph> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fig-parse-worker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (e: MessageEvent<FigParseResult & { error?: string }>) => {
      worker.terminate()
      if (e.data.error) {
        reject(new Error(e.data.error))
        return
      }
      const { nodeChanges, blobs, images: imageEntries } = e.data
      const images = new Map<string, Uint8Array>(imageEntries)
      resolve(importNodeChanges(nodeChanges, blobs, images))
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker failed to parse .fig file'))
    }

    worker.postMessage(buffer, [buffer])
  })
}

export async function parseFigFile(buffer: ArrayBuffer): Promise<SceneGraph> {
  if (typeof Worker !== 'undefined' && IS_BROWSER) {
    const copy = buffer.slice(0)
    try {
      return await parseViaWorker(buffer)
    } catch (e) {
      console.warn('Worker parsing failed, falling back to main thread:', e)
      return parseFigFileSync(copy)
    }
  }
  return parseFigFileSync(buffer)
}

export async function readFigFile(file: File): Promise<SceneGraph> {
  const buffer = await file.arrayBuffer()
  return parseFigFile(buffer)
}
