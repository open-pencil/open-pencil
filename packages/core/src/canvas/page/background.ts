import type { Canvas } from 'canvaskit-wasm'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'

/** FigJam's dots, #C4C4C4, as Figma desktop draws them on a board's #F5F5F5 page. */
const DOT_COLOR = 196 / 255

/** A dot spans 2 canvas units, as in FigJam, but never less than this many screen pixels. */
const DOT_DIAMETER_UNITS = 2
const DOT_MIN_DIAMETER = 1.35

/** FigJam doubles the dot spacing as it zooms out, keeping dots at least this far apart on screen. */
const DOT_MIN_SPACING = 8

/** One dot per grid point, decided per device pixel, so the grid is a single draw at any zoom. */
const DOT_GRID_SHADER = `
uniform float2 origin;
uniform float pitch;
uniform float radius;
uniform float shade;

half4 main(float2 position) {
  float2 offset = position - origin;
  float2 cell = offset - pitch * floor(offset / pitch + 0.5);
  float alpha = clamp(radius + 0.5 - length(cell), 0.0, 1.0);
  return half4(shade * alpha, shade * alpha, shade * alpha, alpha);
}
`

/** The spacing FigJam shows at a zoom: the board grid, doubled until the dots stand apart. */
export function dotGridSpacing(grid: number, zoom: number): number {
  let spacing = grid
  while (spacing * zoom < DOT_MIN_SPACING) spacing *= 2
  return spacing
}

/**
 * Paints the page under its layers: its colour and, on a board, FigJam's dots. The canvas is
 * untransformed, in device pixels; `origin` is where canvas point (0, 0) falls and `scale` how
 * many device pixels a canvas unit covers.
 */
export function paintPageBackground(
  r: SkiaRenderer,
  canvas: Canvas,
  origin: Vector,
  scale: number
): void {
  canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
  if (r.pageDotGrid === null) return
  if (!r.shaders.dotGridEffect) {
    let error = ''
    r.shaders.dotGridEffect = r.ck.RuntimeEffect.Make(DOT_GRID_SHADER, (message) => {
      error = message
    })
    if (!r.shaders.dotGridEffect) throw new Error(`Cannot compile the dot grid: ${error}`)
  }
  const zoom = scale / r.dpr
  const pitch = dotGridSpacing(r.pageDotGrid, zoom) * scale
  const diameter = Math.max(DOT_DIAMETER_UNITS * zoom, DOT_MIN_DIAMETER) * r.dpr
  const shader = r.shaders.dotGridEffect.makeShader([
    origin.x,
    origin.y,
    pitch,
    diameter / 2,
    DOT_COLOR
  ])
  // Skia scales a shader by the paint's alpha, which earlier drawing may have left translucent.
  r.auxFill.setAlphaf(1)
  r.auxFill.setShader(shader)
  canvas.drawPaint(r.auxFill)
  r.auxFill.setShader(null)
  shader.delete()
}
