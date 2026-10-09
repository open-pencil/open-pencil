import type { Canvas } from 'canvaskit-wasm'

import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'

/** Device pixels one document pixel must cover before Figma shows the pixel grid: 800% at 1×. */
export const PIXEL_GRID_MIN_DEVICE_PIXELS = 8

/**
 * The grid's line colour over the page, measured in Figma desktop 126: a light line on a dark page
 * (#1E1E1E becomes #3E3E3E) and a dark one on a light page (#F5F5F5 becomes #E8E8E8).
 */
const DARK_PAGE_LINE: Color = { r: 1, g: 1, b: 1, a: 0.142 }
const LIGHT_PAGE_LINE: Color = { r: 0, g: 0, b: 0, a: 0.053 }

/** Whether the grid shows at this zoom and pixel density. */
export function pixelGridVisible(zoom: number, dpr: number): boolean {
  return zoom * dpr >= PIXEL_GRID_MIN_DEVICE_PIXELS
}

/**
 * Screen positions, in CSS pixels, of the document pixel boundaries across `extent`, each on a
 * whole device pixel so every line is one device pixel wide.
 */
export function pixelGridLines(pan: number, zoom: number, extent: number, dpr: number): number[] {
  if (!pixelGridVisible(zoom, dpr) || extent <= 0) return []
  const first = Math.ceil(-pan / zoom)
  const lines: number[] = []
  for (let pixel = first; pixel * zoom + pan <= extent; pixel++) {
    lines.push(Math.round((pixel * zoom + pan) * dpr) / dpr)
  }
  return lines
}

function lineColor(page: Color): Color {
  const luminance = 0.2126 * page.r + 0.7152 * page.g + 0.0722 * page.b
  return luminance < 0.5 ? DARK_PAGE_LINE : LIGHT_PAGE_LINE
}

/** Figma's pixel grid: a line at every document pixel once zoomed in far enough to tell them apart. */
export function drawPixelGrid(r: SkiaRenderer, canvas: Canvas): void {
  if (!pixelGridVisible(r.zoom, r.dpr)) return
  const color = lineColor(r.pageColor)
  const width = 1 / r.dpr
  const path = new r.ck.PathBuilder()
  for (const x of pixelGridLines(r.panX, r.zoom, r.viewportWidth, r.dpr)) {
    path.addRect(r.ck.LTRBRect(x, 0, x + width, r.viewportHeight))
  }
  for (const y of pixelGridLines(r.panY, r.zoom, r.viewportHeight, r.dpr)) {
    path.addRect(r.ck.LTRBRect(0, y, r.viewportWidth, y + width))
  }
  const lines = path.detachAndDelete()
  r.auxFill.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  canvas.drawPath(lines, r.auxFill)
  lines.delete()
}
