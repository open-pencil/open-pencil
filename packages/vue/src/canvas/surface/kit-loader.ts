import { whenever } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

type CanvasKitLoaderOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  lifecycle: { destroyed: boolean }
  setCanvasKit: (ck: CanvasKit | null) => void
  createSurface: (canvas: HTMLCanvasElement) => void
  loadFonts: () => Promise<unknown> | undefined
  renderNow: () => void
  onReady?: () => void
}

export function useCanvasKitLoader({
  canvasRef,
  lifecycle,
  setCanvasKit,
  createSurface,
  loadFonts,
  renderNow,
  onReady
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
    createSurface(canvas)
    await loadFonts()
    if (isDestroyed()) return
    renderNow()
    onReady?.()
  }

  // Start once there is a canvas: a CanvasSurface child hands its element over after the
  // root has mounted, so waiting for mount alone would find none.
  whenever(canvasRef, () => void init(), { once: true, flush: 'post', immediate: true })

  onScopeDispose(() => {
    lifecycle.destroyed = true
  })
}
