import type { EditorState } from '@open-pencil/core/editor'

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
   * Called once the rendering surface is ready.
   */
  onReady?: () => void
  /**
   * Supplies the view state rendered by this canvas. Defaults to `editor.state`.
   *
   * Multiple canvas surfaces can use independent view state while sharing one
   * document graph, history, and editor event bus.
   */
  getRenderState?: () => EditorState
  /**
   * Receives this canvas surface's CSS viewport size after creation and resize.
   */
  onViewportResize?: (width: number, height: number) => void
}
