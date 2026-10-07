import type { ImagePreviewDecoder } from '@open-pencil/core/canvas'

/**
 * WebP keeps transparency at a fraction of PNG's size and encoding time for photos; browsers
 * that cannot encode it hand back PNG instead.
 */
const PREVIEW_ENCODING = { type: 'image/webp', quality: 0.9 } as const

/** Serialize native browser decodes outside the CanvasKit heap without detaching graph bytes. */
export function createImagePreviewDecoder(): ImagePreviewDecoder {
  let disposed = false
  function assertActive() {
    if (disposed) throw new Error('Image preview stopped')
  }
  return {
    async decode(source, edge) {
      assertActive()
      const data =
        source.buffer instanceof ArrayBuffer
          ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
          : source.slice()
      const bitmap = await createImageBitmap(new Blob([data]))
      try {
        assertActive()
        const originalWidth = bitmap.width
        const originalHeight = bitmap.height
        const scale = Math.min(1, edge / Math.max(originalWidth, originalHeight))
        const canvas = new OffscreenCanvas(
          Math.max(1, Math.round(originalWidth * scale)),
          Math.max(1, Math.round(originalHeight * scale))
        )
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image preview canvas unavailable')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const bytes = new Uint8Array(
          await (await canvas.convertToBlob(PREVIEW_ENCODING)).arrayBuffer()
        )
        assertActive()
        return { bytes, originalWidth, originalHeight }
      } finally {
        bitmap.close()
      }
    },
    destroy() {
      disposed = true
    }
  }
}
