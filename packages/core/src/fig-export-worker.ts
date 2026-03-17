import { compressFigDataSync } from './fig-compress'

interface CompressMessage {
  schemaDeflated: Uint8Array
  kiwiData: Uint8Array
  thumbnailPng: Uint8Array
  metaJson: string
  images: Array<{ name: string; data: Uint8Array }>
}

self.onmessage = (e: MessageEvent<CompressMessage>) => {
  const { schemaDeflated, kiwiData, thumbnailPng, metaJson, images } = e.data
  const result = compressFigDataSync(schemaDeflated, kiwiData, thumbnailPng, metaJson, images)
  self.postMessage(result, { transfer: [result.buffer] })
}
