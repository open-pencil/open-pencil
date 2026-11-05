import type { CanvasKit, Surface } from 'canvaskit-wasm'

import type { Editor } from '@open-pencil/core'
import { IS_BROWSER } from '@open-pencil/core/constants'
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

/** Makes the parking context current, so CanvasKit lets go of the one it held. */
function park(ck: CanvasKit): void {
  const parking = parkingHandle(ck)
  if (!parking) return
  try {
    ck.MakeGrContext(parking)?.delete()
  } catch {
    // A browser drops a page's oldest WebGL contexts once it holds too many, as WebKit does after
    // a few tabs, and reports it only later; the parking context is the oldest, so it is the one
    // gone, and CanvasKit fails on it. A new parking context takes its place.
    ck.deleteContext(parking)
    parkingHandles.delete(ck)
    const replacement = parkingHandle(ck)
    if (replacement) ck.MakeGrContext(replacement)?.delete()
  }
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
  if (wasCurrent) park(ck)
}

/** A canvas's inline size and margins. */
type PinnedStyle = Pick<CSSStyleDeclaration, 'width' | 'height' | 'marginLeft' | 'marginTop'>
const PINNED_PROPERTIES = ['width', 'height', 'marginLeft', 'marginTop'] as const
/** Per canvas: the inline style its owner set, and the style sizeCanvas last wrote over it. */
const pinnedStyles = new WeakMap<HTMLCanvasElement, { own: PinnedStyle; written: PinnedStyle }>()

function inlineStyle(canvas: HTMLCanvasElement): PinnedStyle {
  const { width, height, marginLeft, marginTop } = canvas.style
  return { width, height, marginLeft, marginTop }
}

/**
 * Puts back the inline style the canvas's owner set, so the page's own sizing is measured. A
 * property that differs from what sizeCanvas last wrote was set by the owner since, and becomes
 * theirs; the others keep the owner's earlier value.
 */
function restoreOwnStyle(canvas: HTMLCanvasElement): void {
  const current = inlineStyle(canvas)
  const pinned = pinnedStyles.get(canvas)
  const own = { ...current }
  if (pinned) {
    for (const property of PINNED_PROPERTIES) {
      if (current[property] === pinned.written[property]) own[property] = pinned.own[property]
    }
  }
  pinnedStyles.set(canvas, { own, written: current })
  Object.assign(canvas.style, own)
}

/** Records the style sizeCanvas wrote, so a later change by the owner can be told apart. */
function rememberWrittenStyle(canvas: HTMLCanvasElement): void {
  const pinned = pinnedStyles.get(canvas)
  if (pinned) pinnedStyles.set(canvas, { own: pinned.own, written: inlineStyle(canvas) })
}

/**
 * Sizes the canvas bitmap to the content box the page's CSS gives it, pinned to whole CSS pixels
 * as Figma pins its canvas. A panel sized in percent leaves the box at a fraction of a pixel, and
 * the browser shows a canvas at whole pixels, so its bitmap was stretched by one device pixel
 * across the width, softening every line. The canvas moves under a pixel to the nearest whole
 * one through its margins; pointers map from its box, so they follow. Under a transform, where no
 * snap holds, the canvas takes its layout size rounded and stays where it is. A flex container
 * that centres the canvas moves it by half a margin change, so there the snap can stay a quarter
 * pixel off.
 */
export function sizeCanvas(
  canvas: HTMLCanvasElement,
  editor: Editor,
  onViewportResize?: (width: number, height: number) => void
) {
  const dpr = IS_BROWSER ? window.devicePixelRatio || 1 : 1
  restoreOwnStyle(canvas)
  const box = canvas.getBoundingClientRect()
  const layout = getComputedStyle(canvas)
  const px = (value: string) => Number.parseFloat(value) || 0
  // Border and padding sit outside the bitmap, which fills the content box.
  const inset = {
    left: px(layout.borderLeftWidth) + px(layout.paddingLeft),
    right: px(layout.borderRightWidth) + px(layout.paddingRight),
    top: px(layout.borderTopWidth) + px(layout.paddingTop),
    bottom: px(layout.borderBottomWidth) + px(layout.paddingBottom)
  }
  const borderBox = layout.boxSizing === 'border-box'
  const outerWidth = (px(layout.width) || box.width) + (borderBox ? 0 : inset.left + inset.right)
  const outerHeight = (px(layout.height) || box.height) + (borderBox ? 0 : inset.top + inset.bottom)
  const transformed =
    Math.abs(outerWidth - box.width) > 0.01 || Math.abs(outerHeight - box.height) > 0.01
  const contentLeft = box.left + inset.left
  const contentTop = box.top + inset.top
  const left = transformed ? contentLeft : Math.round(contentLeft)
  const top = transformed ? contentTop : Math.round(contentTop)
  const width = Math.max(
    1,
    transformed
      ? Math.round(outerWidth - inset.left - inset.right)
      : Math.round(box.right - inset.right) - left
  )
  const height = Math.max(
    1,
    transformed
      ? Math.round(outerHeight - inset.top - inset.bottom)
      : Math.round(box.bottom - inset.bottom) - top
  )
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${borderBox ? width + inset.left + inset.right : width}px`
  canvas.style.height = `${borderBox ? height + inset.top + inset.bottom : height}px`
  // The margins the page resolves, such as auto for a centred canvas, plus the snap. A translate
  // would leave the bitmap a fraction of a pixel off, which the browser smooths over.
  if (!transformed) {
    canvas.style.marginLeft = `${px(layout.marginLeft) + left - contentLeft}px`
    canvas.style.marginTop = `${px(layout.marginTop) + top - contentTop}px`
  }
  rememberWrittenStyle(canvas)
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
