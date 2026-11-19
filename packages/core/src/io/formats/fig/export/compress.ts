import {
  buildFigKiwi,
  loadFigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'

import { IS_BROWSER } from '#core/constants'

import type { CompressResult } from './worker'

/** A `.fig` save's document data before it is compressed into the archive's `canvas.fig`. */
export interface FigCanvasParts {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  figKiwiVersion?: number
  compressionLevel?: number
  kind: FigFileKind
}

/** Compresses a save's document data, as a host can do natively off the main thread. */
export type FigCanvasCompressor = (parts: FigCanvasParts) => Promise<Uint8Array>

let hostCompressor: FigCanvasCompressor | null = null

/**
 * Lets the host compress the document data of every `.fig` written from now on, as the desktop
 * app does in Rust, since high compression levels take seconds. Without one, a worker compresses
 * it, or the main thread where workers are unavailable. Images never pass through: the archive is
 * written around the compressed data where the images already are.
 */
export function setFigCanvasCompressor(compressor: FigCanvasCompressor | null): void {
  hostCompressor = compressor
}

/** The `fig-kiwi` container of the document data, compressed on this thread. */
export async function buildFigCanvas(parts: FigCanvasParts): Promise<Uint8Array> {
  return buildFigKiwi(
    parts.schemaDeflated,
    parts.kiwiData,
    parts.figKiwiVersion,
    await loadFigDataCompressor(parts.compressionLevel),
    parts.kind
  )
}

function buildInWorker(parts: FigCanvasParts): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CompressResult>) => {
      if (event.data instanceof Uint8Array) resolve(event.data)
      else reject(new Error(event.data.error))
      worker.terminate()
    }
    worker.onerror = (error) => {
      reject(new Error(error.message))
      worker.terminate()
    }
    // Do NOT use transferables here. toUint8Array() in ByteBuffer returns a view of the
    // internal buffer, so transferring kiwiData.buffer or schemaDeflated.buffer detaches
    // buffers that may be shared with other views, causing "already detached" errors on
    // subsequent saves. Structured clone (the default) copies the data safely.
    worker.postMessage(parts, [])
  })
}

/** The document data compressed by the host, in a worker, or here, in that order of preference. */
export function compressFigCanvas(parts: FigCanvasParts): Promise<Uint8Array> {
  if (hostCompressor) return hostCompressor(parts)
  if (typeof Worker !== 'undefined' && IS_BROWSER) return buildInWorker(parts)
  return buildFigCanvas(parts)
}
