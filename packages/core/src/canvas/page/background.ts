import type { Canvas } from 'canvaskit-wasm'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledEffect, fillWithShader, keptShader } from '#core/canvas/renderer/shaders'

/** FigJam's dots, #C4C4C4, as Figma desktop draws them on a board's #F5F5F5 page. */
const DOT_COLOR = 196 / 255

/** A dot spans 2 canvas units, as in FigJam, but never less than this many screen pixels. */
const DOT_DIAMETER_UNITS = 2
const DOT_MIN_DIAMETER = 1.35

/** FigJam doubles the dot spacing as it zooms out, keeping dots at least this far apart on screen. */
const DOT_MIN_SPACING = 8

/**
 * One dot per grid point, decided per device pixel, so the grid is a single draw at any zoom. It
 * puts a dot at its own origin, where the canvas is moved to draw it, so tiles at one zoom share it.
 */
const DOT_GRID_SHADER = `
uniform float pitch;
uniform float radius;
uniform float shade;

half4 main(float2 position) {
  float2 cell = position - pitch * floor(position / pitch + 0.5);
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
  const effect = compiledEffect(r.ck, r.shaders, 'dotGridEffect', DOT_GRID_SHADER, 'dot grid')
  const zoom = scale / r.dpr
  const pitch = dotGridSpacing(r.pageDotGrid, zoom) * scale
  const diameter = Math.max(DOT_DIAMETER_UNITS * zoom, DOT_MIN_DIAMETER) * r.dpr
  const shader = keptShader(r.shaders, 'dotGrid', effect, [pitch, diameter / 2, DOT_COLOR])
  canvas.save()
  canvas.translate(origin.x, origin.y)
  fillWithShader(canvas, r.auxFill, shader)
  canvas.restore()
}
