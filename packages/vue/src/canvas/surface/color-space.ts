import { IS_BROWSER } from '@open-pencil/core/constants'
import type { DocumentColorSpace } from '@open-pencil/scene-graph'

export type PresentationColorSpace = 'srgb' | 'display-p3'

/** The drawing-buffer storage API is not in the installed DOM lib yet (Chromium 122+). */
interface ColorManagedContext {
  drawingBufferColorSpace?: 'srgb' | 'display-p3'
  drawingBufferFormat?: number
  drawingBufferWidth?: number
  drawingBufferHeight?: number
  drawingBufferStorage?: (format: number, width: number, height: number) => void
  RGBA8?: number
  RGBA16F?: number
  getExtension?: (name: string) => { loseContext?: () => void } | null
  getParameter?: (name: number) => unknown
}

const UNMASKED_RENDERER_WEBGL = 0x9246

export interface PresentationRequest {
  documentColorSpace: DocumentColorSpace
  wideGamutDisplay: boolean
  width: number
  height: number
}

/** Software rasterizers advertise the float extensions but cannot render offscreen float targets. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i

export function isHardwareRenderer(renderer: string | null | undefined): boolean {
  if (typeof renderer !== 'string' || renderer.length === 0) return false
  return !SOFTWARE_RENDERER.test(renderer)
}

function hasFloatDrawingBuffer(context: ColorManagedContext): boolean {
  if (typeof context.drawingBufferStorage !== 'function') return false
  if (context.RGBA16F === undefined) return false
  // WebGL methods require their context as `this`, so never call them unbound.
  if (!context.getExtension) return false
  return (
    context.getExtension('EXT_color_buffer_float') != null &&
    context.getExtension('EXT_float_blend') != null
  )
}

/** Read the buffer back instead of trusting a write TS narrowed to the requested value. */
function readColorSpace(context: ColorManagedContext): string {
  return context.drawingBufferColorSpace ?? 'srgb'
}

/** Reinstall the drawing buffer only when its format or size drifted. */
function installDrawingBuffer(
  context: ColorManagedContext,
  format: number,
  request: PresentationRequest
): boolean {
  const matches =
    context.drawingBufferFormat === format &&
    context.drawingBufferWidth === request.width &&
    context.drawingBufferHeight === request.height
  if (matches) return true
  if (typeof context.drawingBufferStorage !== 'function') return false
  try {
    context.drawingBufferStorage(format, request.width, request.height)
  } catch {
    return false
  }
  return context.drawingBufferFormat === format
}

/**
 * CanvasKit 0.41 wraps sRGB on-screen surfaces as RGBA_8888 but every other color
 * space as RGBA_F16 — the pixel format is not configurable (Skia's
 * `modules/canvaskit/canvaskit_bindings.cpp`, `ColorSettings`). A Display-P3 surface
 * therefore only matches the browser buffer when that buffer is floating point, which
 * `drawingBufferStorage` provides on Chromium 122+; WebKit and Firefox have no
 * implementation. Presenting P3 over the default 8-bit buffer produces invalid
 * destination copies and broken blend modes, so it falls back to sRGB.
 *
 * Returns the space actually configured, or null when the buffer cannot be made
 * consistent with the requested surface.
 */
export function configurePresentation(
  context: ColorManagedContext | null,
  request: PresentationRequest
): PresentationColorSpace | null {
  if (!context?.drawingBufferColorSpace) return 'srgb'
  try {
    if (
      request.documentColorSpace === 'display-p3' &&
      request.wideGamutDisplay &&
      hasFloatDrawingBuffer(context) &&
      context.RGBA16F !== undefined &&
      installDrawingBuffer(context, context.RGBA16F, request)
    ) {
      context.drawingBufferColorSpace = 'display-p3'
      if (readColorSpace(context) === 'display-p3') return 'display-p3'
    }
    // 8-bit is already the browser default, so sRGB only has to undo a float buffer we
    // installed earlier. Reallocating the default buffer on every resize would decouple it
    // from the canvas size. Browsers without drawingBufferStorage never need this.
    if (
      context.RGBA8 !== undefined &&
      context.drawingBufferFormat !== undefined &&
      context.drawingBufferFormat !== context.RGBA8 &&
      !installDrawingBuffer(context, context.RGBA8, request)
    ) {
      return null
    }
    if (context.drawingBufferColorSpace !== 'srgb') context.drawingBufferColorSpace = 'srgb'
    return readColorSpace(context) === 'srgb' ? 'srgb' : null
  } catch {
    return null
  }
}

let wideGamutSupport: boolean | null = null

/**
 * Whether this browser can present a Display-P3 canvas at all: a P3 display plus the
 * floating-point drawing buffer CanvasKit's P3 on-screen surface requires.
 */
function rendererName(context: ColorManagedContext): string | null {
  const info = context.getExtension?.('WEBGL_debug_renderer_info')
  if (!info || !context.getParameter) return null
  const renderer = context.getParameter(UNMASKED_RENDERER_WEBGL)
  return typeof renderer === 'string' ? renderer : null
}

function probeDrawingBufferContext(): ColorManagedContext | null {
  const probe = document.createElement('canvas')
  probe.width = 1
  probe.height = 1
  return probe.getContext('webgl2') ?? probe.getContext('webgl')
}

function detectWideGamutSupport(): boolean {
  if (!IS_BROWSER) return false
  if (!window.matchMedia('(color-gamut: p3)').matches) return false
  const context = probeDrawingBufferContext()
  if (!context) return false
  // Software renderers cannot render the offscreen float targets Skia needs once the
  // drawing buffer is float, and a software compositor has no wide-gamut output either.
  const supported = isHardwareRenderer(rendererName(context)) && hasFloatDrawingBuffer(context)
  context.getExtension?.('WEBGL_lose_context')?.loseContext?.()
  return supported
}

/**
 * Whether this browser can present a Display-P3 canvas: a P3 display, a hardware
 * renderer, and the floating-point drawing buffer CanvasKit's P3 on-screen surface
 * requires (Chromium 122+; WebKit and Firefox have no drawingBufferStorage).
 */
export function supportsWideGamutPresentation(): boolean {
  wideGamutSupport ??= detectWideGamutSupport()
  return wideGamutSupport
}
