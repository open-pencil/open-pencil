import { useResizeObserver } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose, type Ref } from 'vue'

/** How eagerly a layer follows the canvas host as it changes size. */
export type CanvasResizeMode = 'live' | 'settle'

/** Long enough to outlast a drag's frame-to-frame jitter, short enough to feel immediate. */
const SETTLE_MS = 120

type ResizeObserverOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  getCanvasKitValue: () => CanvasKit | null
  resizeCanvas: (canvas: HTMLCanvasElement) => void
  mode?: CanvasResizeMode
}

export function useCanvasResizeObserver({
  canvasRef,
  getCanvasKitValue,
  resizeCanvas,
  mode = 'live'
}: ResizeObserverOptions) {
  let pending = 0
  let settleTimer: ReturnType<typeof setTimeout> | null = null

  function applyResize() {
    const canvas = canvasRef.value
    if (!canvas || !getCanvasKitValue()) return
    resizeCanvas(canvas)
  }

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
    // 'settle' layers rebuild once the size stops changing rather than every frame. Each
    // rebuild allocates a GPU surface and repaints, and paying that per layer per frame is
    // the bulk of a drag's cost — a layer drawing only chrome does not need to keep pace.
    if (mode === 'settle') {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        settleTimer = null
        applyResize()
      }, SETTLE_MS)
      return
    }
    if (pending) return
    pending = requestAnimationFrame(() => {
      pending = 0
      applyResize()
    })
  })

  onScopeDispose(() => {
    cancelAnimationFrame(pending)
    if (settleTimer) clearTimeout(settleTimer)
  })
}
