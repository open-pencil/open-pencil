import { compressFigDataSync } from '@open-pencil/fig'

interface CompressMessage {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPNG: Uint8Array
  metaJSON: string
  images: Array<{ name: string; data: Uint8Array }>
  figKiwiVersion?: number
}

self.onmessage = (e: MessageEvent<CompressMessage>) => {
  const { schemaDeflated, kiwiData, thumbnailPNG, metaJSON, images, figKiwiVersion } = e.data
  const result = compressFigDataSync(
    schemaDeflated,
    kiwiData,
    thumbnailPNG,
    metaJSON,
    images,
    figKiwiVersion
  )
  self.postMessage(result, { transfer: [result.buffer] })
}
