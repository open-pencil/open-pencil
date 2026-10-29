import { compressFigDataSync } from '@open-pencil/fig'
import { loadFigDataCompressor } from '@open-pencil/kiwi/fig/container'

interface CompressMessage {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
  compressionLevel?: number
}

/** The archive, or why it could not be written: a rejected handler would never reach `onerror`. */
export type CompressResult = Uint8Array | { error: string }

self.onmessage = async (e: MessageEvent<CompressMessage>) => {
  const { schemaDeflated, kiwiData, thumbnailPNG, metaJSON, images, figKiwiVersion } = e.data
  try {
    const result = compressFigDataSync(
      schemaDeflated,
      kiwiData,
      thumbnailPNG,
      metaJSON,
      images,
      figKiwiVersion,
      await loadFigDataCompressor(e.data.compressionLevel)
    )
    self.postMessage(result, { transfer: [result.buffer] })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
