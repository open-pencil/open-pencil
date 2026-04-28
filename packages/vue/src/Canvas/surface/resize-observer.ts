import { useResizeObserver } from '@vueuse/core'

import type { CanvasKit } from 'canvaskit-wasm'
import type { Ref } from 'vue'

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

  useResizeObserver(canvasRef, () => {
    const canvas = canvasRef.value
    if (!canvas || !getCanvasKitValue() || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      resizeCanvas(canvas)
    })
  })

  return { cancelResize }
}
