import type { CanvasKit, Surface } from 'canvaskit-wasm'

import type { Editor } from '@open-pencil/core/editor'

import type { UseCanvasOptions } from '#vue/canvas/surface/types'

type GLContext = ReturnType<CanvasKit['MakeGrContext']>

export type CanvasGLContext = GLContext

/**
 * Match the backing store to the canvas host and publish the new size to the editor.
 *
 * Returns whether the backing store actually changed — assigning `width`/`height`
 * reallocates and clears it even when the value is identical, and every such change
 * forces a new GPU surface downstream, so callers skip that work when nothing moved.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, editor: Editor): boolean {
  const dpr = window.devicePixelRatio || 1
  // Truncated, matching the integer coercion an assignment would apply anyway.
  const width = Math.trunc(canvas.clientWidth * dpr)
  const height = Math.trunc(canvas.clientHeight * dpr)
  const changed = canvas.width !== width || canvas.height !== height
  if (changed) {
    canvas.width = width
    canvas.height = height
  }
  if ('setViewportSize' in editor && typeof editor.setViewportSize === 'function') {
    editor.setViewportSize(canvas.clientWidth, canvas.clientHeight)
  }
  return changed
}

export function makeGLSurface(
  ck: CanvasKit,
  canvas: HTMLCanvasElement,
  editor: Editor,
  options: UseCanvasOptions | undefined,
  glContext: GLContext | null
): { surface: Surface | null; glContext: GLContext | null } {
  let context = glContext
  if (!context) {
    const glAttrs = options?.preserveDrawingBuffer ? { preserveDrawingBuffer: 1 } : undefined
    const handle = ck.GetWebGLContext(canvas, glAttrs)
    if (!handle) return { surface: null, glContext: context }
    context = ck.MakeGrContext(handle)
  }
  if (!context) return { surface: null, glContext: context }

  const preferredSpace = editor.graph.documentColorSpace
  const colorSpaces =
    preferredSpace === 'display-p3'
      ? [ck.ColorSpace.DISPLAY_P3, ck.ColorSpace.SRGB]
      : [ck.ColorSpace.SRGB]

  for (const colorSpace of colorSpaces) {
    const surface = ck.MakeOnScreenGLSurface(context, canvas.width, canvas.height, colorSpace)
    if (surface) return { surface, glContext: context }
  }

  return { surface: null, glContext: context }
}
