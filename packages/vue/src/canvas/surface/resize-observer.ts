import { useResizeObserver } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose, type Ref } from 'vue'

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
  let pending = 0

  /**
   * Coalesce to one resize per animation frame.
   *
   * A splitter drag mutates panel styles on every pointermove — faster than the display
   * refreshes — and each mutation flushes layout and notifies us. Resizing on every
   * notification rebuilds the surface and repaints more often than the screen can show,
   * so the work queues and the canvas falls progressively behind the cursor, then drains
   * once the drag stops.
   *
   * The pending pass re-reads the canvas at execution time, so it always applies the
   * latest size rather than the one that scheduled it, and any change arriving afterwards
   * simply notifies again. Nothing is dropped.
   */
  useResizeObserver(canvasRef, () => {
    if (pending) return
    pending = requestAnimationFrame(() => {
      pending = 0
      const canvas = canvasRef.value
      if (!canvas || !getCanvasKitValue()) return
      resizeCanvas(canvas)
    })
  })

  onScopeDispose(() => cancelAnimationFrame(pending))
}
