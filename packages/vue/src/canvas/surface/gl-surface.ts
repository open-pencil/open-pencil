import type { CanvasKit, Surface } from 'canvaskit-wasm'

import { IS_BROWSER } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { DocumentColorSpace } from '@open-pencil/scene-graph'

import type { UseCanvasOptions } from '#vue/canvas/surface/types'

import {
  configurePresentation,
  supportsWideGamutPresentation,
  type PresentationColorSpace
} from './color-space'

type GLContext = ReturnType<CanvasKit['MakeGrContext']>
type GLHandle = ReturnType<CanvasKit['GetWebGLContext']>

export type CanvasGLContext = GLContext
export type CanvasGLHandle = GLHandle

const parkingHandles = new WeakMap<CanvasKit, GLHandle>()

/** A 1×1 offscreen WebGL context that stays registered, so another context can become current. */
function parkingHandle(ck: CanvasKit): GLHandle | null {
  const existing = parkingHandles.get(ck)
  if (existing !== undefined) return existing
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const handle = ck.GetWebGLContext(canvas)
  if (!handle) return null
  parkingHandles.set(ck, handle)
  return handle
}

/**
 * Unregisters a canvas's WebGL context from CanvasKit. `deleteContext` leaves CanvasKit holding
 * the last current context, which keeps the canvas, and every component its element reaches,
 * alive; when this context was current, a parking context takes its place.
 */
export function releaseWebGLContext(
  ck: CanvasKit,
  handle: GLHandle,
  canvas: HTMLCanvasElement | null
): void {
  const context = canvas ? (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) : null
  const wasCurrent = context !== null && Reflect.get(ck, 'ctx') === context
  ck.deleteContext(handle)
  if (!wasCurrent) return
  const parking = parkingHandle(ck)
  if (parking) ck.MakeGrContext(parking)?.delete()
}

export function sizeCanvas(
  canvas: HTMLCanvasElement,
  editor: Editor,
  onViewportResize?: (width: number, height: number) => void
) {
  const dpr = IS_BROWSER ? window.devicePixelRatio || 1 : 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  if (onViewportResize) {
    onViewportResize(width, height)
  } else if ('setViewportSize' in editor && typeof editor.setViewportSize === 'function') {
    editor.setViewportSize(width, height)
  }
}

export function makeGLSurface(
  ck: CanvasKit,
  canvas: HTMLCanvasElement,
  options: UseCanvasOptions | undefined,
  glContext: GLContext | null,
  documentColorSpace: DocumentColorSpace
): {
  surface: Surface | null
  glContext: GLContext | null
  /**
   * The WebGL context this call registered with CanvasKit, which the caller must release with
   * `deleteContext`: CanvasKit's context table otherwise keeps the canvas, and everything its
   * element reaches, alive. Null when the existing context was reused.
   */
  glHandle: GLHandle | null
  presentation: PresentationColorSpace | null
} {
  let context = glContext
  const glAttrs = options?.preserveDrawingBuffer ? { preserveDrawingBuffer: 1 } : undefined
  const handle = context ? null : ck.GetWebGLContext(canvas, glAttrs)
  if (!context && !handle) {
    return { surface: null, glContext: context, glHandle: null, presentation: null }
  }

  const buffer = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  const presentation = configurePresentation(buffer, {
    documentColorSpace,
    wideGamutDisplay: IS_BROWSER && supportsWideGamutPresentation(),
    width: canvas.width,
    height: canvas.height
  })
  if (!presentation) {
    if (handle) ck.deleteContext(handle)
    return { surface: null, glContext: context, glHandle: null, presentation: null }
  }
  if (!context && handle) context = ck.MakeGrContext(handle)
  if (!context) {
    if (handle) ck.deleteContext(handle)
    return { surface: null, glContext: context, glHandle: null, presentation: null }
  }

  return {
    surface: ck.MakeOnScreenGLSurface(
      context,
      canvas.width,
      canvas.height,
      presentation === 'display-p3' ? ck.ColorSpace.DISPLAY_P3 : ck.ColorSpace.SRGB
    ),
    glContext: context,
    glHandle: handle,
    presentation
  }
}
