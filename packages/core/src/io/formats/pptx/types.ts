import type { CanvasKit } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas'

export interface PPTXExportStats {
  editable: number
  fallback: number
  skipped: number
  /** Fallback reason → count, for fidelity measurement. */
  fallbackReasons: Record<string, number>
}

export interface PPTXRasterizeOptions {
  /** Render only the nodes' own paint, dropping their children. */
  paintOnly?: boolean
}

/** Renders the given nodes to a PNG byte array (used for fallback images). */
export type PPTXRasterize = (
  nodeIds: string[],
  scale: number,
  options?: PPTXRasterizeOptions
) => Promise<Uint8Array | null>

export interface PPTXExportOptions {
  /** Raster scale for fallback images. Defaults to 2. */
  fallbackScale?: number
  /**
   * Custom rasterizer for fallback images. Defaults to an isolated render of
   * the node subtree (ancestor backgrounds cleared) through the raster
   * pipeline — headless, or renderer-bound when `context` provides one.
   */
  rasterize?: PPTXRasterize
  /** Live renderer to reuse for fallback rasterization (browser contexts). */
  context?: { canvasKit?: CanvasKit; renderer?: SkiaRenderer }
  /** Receives conversion statistics after the export completes. */
  onStats?: (stats: PPTXExportStats) => void
}
