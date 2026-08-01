/**
 * Options for {@link useCanvas}.
 */
export type CanvasRenderLayer = 'full' | 'scene' | 'overlays'

export interface UseCanvasOptions {
  /**
   * Selects which render layer this canvas owns.
   */
  layer?: CanvasRenderLayer
  /**
   * Forces ruler visibility on or off for this canvas.
   *
   * When omitted, the composable falls back to viewport and URL-param logic.
   */
  showRulers?: boolean
  /**
   * Keeps the drawing buffer after presenting frames.
   *
   * Useful for screenshot or pixel-readback workflows, but may increase memory
   * usage depending on the browser and GPU backend.
   */
  preserveDrawingBuffer?: boolean
  /**
   * How eagerly this layer follows the canvas host as it resizes.
   *
   * 'live' rebuilds once per frame. 'settle' waits for resizing to stop, trading a briefly
   * stale layer for not allocating a GPU surface every frame — worth it for a layer that
   * draws chrome rather than document pixels.
   */
  resizeMode?: 'live' | 'settle'
  /**
   * Called once the rendering surface is ready.
   */
  onReady?: () => void
  /**
   * Called after the canvas host changed size and the editor viewport was updated,
   * before the frame is repainted.
   *
   * Use it for policy that depends on the viewport size — re-fitting content, for
   * example. Runs on the surface's own resize pass, so it is already coalesced to one
   * call per frame and ordered after the new size reaches the editor.
   */
  onResize?: () => void
}
