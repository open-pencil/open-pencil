import { compressFigDataSync } from '@open-pencil/fig'
import {
  buildFigKiwi,
  loadFigDataCompressor,
  type FigFileKind
} from '@open-pencil/kiwi/fig/container'

interface CompressMessage {
  /** Absent means the whole archive, as `compressFigData` asks for; `canvas` is document data only. */
  kind?: 'archive' | 'canvas'
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
  compressionLevel?: number
  fileKind?: FigFileKind
}

/** The archive, or why it could not be written: a rejected handler would never reach `onerror`. */
export type CompressResult = Uint8Array | { error: string }

self.onmessage = async (e: MessageEvent<CompressMessage>) => {
  const message = e.data
  try {
    const compress = await loadFigDataCompressor(message.compressionLevel)
    if (message.kind === 'canvas') {
      const canvasFig = buildFigKiwi(
        message.schemaDeflated,
        message.kiwiData,
        message.figKiwiVersion,
        compress,
        message.fileKind
      )
      self.postMessage(canvasFig, { transfer: [canvasFig.buffer] })
      return
    }
    const result = compressFigDataSync(
      message.schemaDeflated,
      message.kiwiData,
      message.thumbnailPNG,
      message.metaJSON,
      message.images,
      message.figKiwiVersion,
      compress,
      message.fileKind
    )
    self.postMessage(result, { transfer: [result.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
