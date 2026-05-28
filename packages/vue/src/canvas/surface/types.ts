/**
 * Options for {@link useCanvas}.
 */
import type { EditorState } from '@open-pencil/core/editor'

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
   * Supplies pane-specific render state for split canvas surfaces.
   */
  getRenderState?: () => EditorState
  /**
   * Receives CSS pixel viewport size changes for this canvas.
   */
  onViewportResize?: (width: number, height: number) => void
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
}
