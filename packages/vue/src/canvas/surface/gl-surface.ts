import type { UseCanvasOptions } from '#vue/canvas/surface/types'
import type { Editor } from '@open-pencil/core/editor'
import type { CanvasKit, Surface } from 'canvaskit-wasm'

type GLContext = ReturnType<CanvasKit['MakeGrContext']>

export type CanvasGLContext = GLContext

export function sizeCanvas(canvas: HTMLCanvasElement, editor: Editor) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.clientWidth * dpr
  canvas.height = canvas.clientHeight * dpr
  const maybeSizedEditor = editor as Editor & {
    setViewportSize?: (width: number, height: number) => void
  }
  maybeSizedEditor.setViewportSize?.(canvas.clientWidth, canvas.clientHeight)
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
