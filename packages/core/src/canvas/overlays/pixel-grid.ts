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
 * One line per document pixel, decided per device pixel: the line for document pixel k sits on
 * device pixel round(offset + k · step), the same rounding a drawn rectangle would get. Computing
 * it in the shader keeps the grid one draw call, whatever the zoom or viewport.
 */
const PIXEL_GRID_SHADER = `
uniform float2 gridOffset;
uniform float2 gridSpacing;
uniform float4 lineColor;
uniform float dpr;

bool onLine(float device, float origin, float spacing) {
  float pixel = floor(device);
  float nearest = floor((pixel - origin) / spacing + 0.5);
  return pixel == floor(origin + nearest * spacing + 0.5);
}

half4 main(float2 position) {
  float2 device = position * dpr;
  if (onLine(device.x, gridOffset.x, gridSpacing.x) || onLine(device.y, gridOffset.y, gridSpacing.y))
    return half4(lineColor.rgb * lineColor.a, lineColor.a);
  return half4(0);
}
`

function lineColor(page: Color): Color {
  const luminance = 0.2126 * page.r + 0.7152 * page.g + 0.0722 * page.b
  return luminance < 0.5 ? DARK_PAGE_LINE : LIGHT_PAGE_LINE
}

/** Figma's pixel grid: a line at every document pixel once zoomed in far enough to tell them apart. */
export function drawPixelGrid(r: SkiaRenderer, canvas: Canvas): void {
  if (!pixelGridVisible(r.zoom, r.dpr)) return
  if (!r.pixelGridEffect) {
    let error = ''
    r.pixelGridEffect = r.ck.RuntimeEffect.Make(PIXEL_GRID_SHADER, (message) => {
      error = message
    })
    if (!r.pixelGridEffect) throw new Error(`Cannot compile the pixel grid: ${error}`)
  }
  const color = lineColor(r.pageColor)
  const step = r.zoom * r.dpr
  const shader = r.pixelGridEffect.makeShader([
    r.panX * r.dpr,
    r.panY * r.dpr,
    step,
    step,
    color.r,
    color.g,
    color.b,
    color.a,
    r.dpr
  ])
  // Skia scales a shader by the paint's alpha, which earlier overlays may have left translucent.
  r.auxFill.setAlphaf(1)
  r.auxFill.setShader(shader)
  canvas.drawRect(r.ck.LTRBRect(0, 0, r.viewportWidth, r.viewportHeight), r.auxFill)
  r.auxFill.setShader(null)
  shader.delete()
}
