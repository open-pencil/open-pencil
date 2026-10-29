import { whenever } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

type CanvasKitLoaderOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  lifecycle: { destroyed: boolean }
  setCanvasKit: (ck: CanvasKit | null) => void
  /** Whether a surface the canvas can draw on was made. */
  createSurface: (canvas: HTMLCanvasElement) => boolean
  loadFonts: () => Promise<unknown> | undefined
  renderNow: () => void
  onReady?: () => void
  onFailed?: (error: unknown) => void
}

export function useCanvasKitLoader({
  canvasRef,
  lifecycle,
  setCanvasKit,
  createSurface,
  loadFonts,
  renderNow,
  onReady,
  onFailed
}: CanvasKitLoaderOptions) {
  const isDestroyed = () => lifecycle.destroyed

  async function init() {
    const canvas = canvasRef.value
    if (!canvas || isDestroyed()) return

    setCanvasKit(await getCanvasKit())
    if (isDestroyed()) return

    await new Promise((resolve) => {
      requestAnimationFrame(resolve)
    })
    if (!createSurface(canvas)) throw new Error('WebGL is unavailable, so the canvas cannot draw')
    await loadFonts()
    if (isDestroyed()) return
    renderNow()
    onReady?.()
  }

  // Start once there is a canvas: a CanvasSurface child hands its element over after the
  // root has mounted, so waiting for mount alone would find none.
  whenever(
    canvasRef,
    () =>
      void init().catch((error: unknown) => {
        if (!onFailed) throw error
        if (!isDestroyed()) onFailed(error)
      }),
    { once: true, flush: 'post', immediate: true }
  )

  onScopeDispose(() => {
    lifecycle.destroyed = true
  })
}
