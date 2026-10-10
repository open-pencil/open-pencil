import type { ShaderRasterizer } from '@open-pencil/core/editor'

/** Whether this browser can draw shaders, which need WebGPU. */
export function canDrawShaders(): boolean {
  // oxlint-disable-next-line compat/compat -- WebGPU is optional: shader paints keep their saved frame without it.
  return typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu !== undefined
}

/**
 * Draws shader frames with the `shaders` library's preset renderer on a detached WebGPU canvas,
 * one at a time, and encodes each as PNG. The library is loaded on the first frame, so documents
 * without shaders never fetch it. Null where the browser has no WebGPU.
 */
export function createShaderRasterizer(): ShaderRasterizer | null {
  if (!canDrawShaders()) return null
  let destroyed = false
  return {
    async render(preset, size) {
      const { createRendererFromJSON } = await import('shaders/core')
      if (destroyed) return null
      const canvas = document.createElement('canvas')
      // The renderer sizes its buffer at the device pixel ratio itself.
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(size.width / ratio))
      canvas.height = Math.max(1, Math.round(size.height / ratio))
      const renderer = createRendererFromJSON(structuredClone(preset))
      try {
        await renderer.initialize(canvas)
        // A still frame: the clocks stay at zero. The first frame only prepares the effects'
        // pipelines, so the one kept is the second; reading the canvas waits for the GPU.
        await renderer.renderFrame({ deltaSeconds: 0, waitForGpu: false })
        await renderer.renderFrame({ deltaSeconds: 0, waitForGpu: false })
        const encoded = new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png')
        })
        const blob = await encoded
        if (destroyed) return null
        return blob ? new Uint8Array(await blob.arrayBuffer()) : null
      } finally {
        renderer.dispose()
      }
    },
    destroy() {
      destroyed = true
    }
  }
}
