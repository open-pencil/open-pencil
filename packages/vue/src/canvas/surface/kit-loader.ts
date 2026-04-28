import { onMounted, onScopeDispose } from 'vue'

import { getCanvasKit } from '@open-pencil/core/canvaskit'

import type { CanvasKit } from 'canvaskit-wasm'
import type { Ref } from 'vue'

type CanvasKitLoaderOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  lifecycle: { destroyed: boolean }
  setCanvasKit: (ck: CanvasKit | null) => void
  createSurface: (canvas: HTMLCanvasElement) => void
  loadFonts: () => Promise<unknown> | undefined
  renderNow: () => void
}

export function useCanvasKitLoader({
  canvasRef,
  lifecycle,
  setCanvasKit,
  createSurface,
  loadFonts,
  renderNow
}: CanvasKitLoaderOptions) {
  const isDestroyed = () => lifecycle.destroyed

  async function init() {
    const canvas = canvasRef.value
    if (!canvas || isDestroyed()) return

    setCanvasKit(await getCanvasKit())
    if (isDestroyed()) return

    await new Promise((resolve) => requestAnimationFrame(resolve))
    createSurface(canvas)
    await loadFonts()
    if (!isDestroyed()) renderNow()
  }

  onMounted(() => {
    void init()
  })

  onScopeDispose(() => {
    lifecycle.destroyed = true
  })
}
