import { useDevicePixelRatio, useResizeObserver } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import { watch, type Ref } from 'vue'

type ResizeObserverOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  getCanvasKitValue: () => CanvasKit | null
  resizeCanvas: (canvas: HTMLCanvasElement) => void
}

export function useCanvasResizeObserver({
  canvasRef,
  getCanvasKitValue,
  resizeCanvas
}: ResizeObserverOptions) {
  let resizeRaf = 0

  function cancelResize() {
    cancelAnimationFrame(resizeRaf)
  }

  function scheduleResize() {
    const canvas = canvasRef.value
    if (!canvas || !getCanvasKitValue() || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      resizeCanvas(canvas)
    })
  }

  // The canvas holds a size pinned to whole pixels, so its container tells when the page resizes.
  useResizeObserver([canvasRef, () => canvasRef.value?.parentElement], scheduleResize)
  // A move to a screen with another pixel ratio leaves the box as it was, so no resize reports it;
  // the bitmap is sized for the new ratio here instead of being stretched.
  const { pixelRatio } = useDevicePixelRatio()
  watch(pixelRatio, scheduleResize)

  return { cancelResize }
}
