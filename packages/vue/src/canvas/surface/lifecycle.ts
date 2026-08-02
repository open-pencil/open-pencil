import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'

import { makeGLSurface, sizeCanvas, type CanvasGLContext } from '#vue/canvas/surface/gl-surface'
import { useCanvasKitLoader } from '#vue/canvas/surface/kit-loader'
import { createCanvasRenderLoop } from '#vue/canvas/surface/render-loop'
import { useCanvasResizeObserver } from '#vue/canvas/surface/resize-observer'
import type { UseCanvasOptions } from '#vue/canvas/surface/types'

type SurfaceManagerState = {
  renderer: SkiaRenderer | null
  glContext: CanvasGLContext | null
  /** The element the GL context is bound to, so it can be released on teardown. */
  canvas: HTMLCanvasElement | null
}

/**
 * Give the browser back the canvas element's WebGL context.
 *
 * Deleting Skia's GrContext frees Skia's own objects but leaves the underlying WebGL
 * context attached to the element, alive until it happens to be collected. Chrome caps
 * how many may exist at once and drops the oldest when the cap is reached — which, once
 * enough canvases have been mounted and discarded, is a context still in use. That shows
 * up as `Too many active WebGL contexts` followed by rendering dying somewhere unrelated.
 *
 * Only safe when the element itself is being discarded: a surface rebuilt on the same
 * canvas must keep its context.
 */
function releaseCanvasContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (!(gl instanceof WebGLRenderingContext) && !(gl instanceof WebGL2RenderingContext)) return
  gl.getExtension('WEBGL_lose_context')?.loseContext()
}

export function createCanvasSurfaceManager({
  editor,
  canvasRef,
  options,
  getCanvasKit,
  isDestroyed,
  shouldShowRulers
}: {
  editor: Editor
  canvasRef: { value: HTMLCanvasElement | null }
  options: UseCanvasOptions | undefined
  getCanvasKit: () => CanvasKit | null
  isDestroyed: () => boolean
  shouldShowRulers: () => boolean
}) {
  const state: SurfaceManagerState = { renderer: null, glContext: null, canvas: null }
  let sceneBackingRenderTimer: ReturnType<typeof setTimeout> | null = null

  function clearSceneBackingRenderTimer() {
    if (sceneBackingRenderTimer === null) return
    clearTimeout(sceneBackingRenderTimer)
    sceneBackingRenderTimer = null
  }

  function createSurface(
    canvas: HTMLCanvasElement,
    { reloadFonts = false }: { reloadFonts?: boolean } = {}
  ) {
    const ck = getCanvasKit()
    if (!ck) return

    if (state.renderer) editor.removeCanvasRenderer(state.renderer)
    state.renderer?.destroy()
    state.renderer = null
    state.glContext?.delete()
    state.glContext = null

    sizeCanvas(canvas, editor)

    const result = makeGLSurface(ck, canvas, editor, options, state.glContext)
    state.glContext = result.glContext
    const surface = result.surface
    if (!surface) {
      canvas.dataset.surfaceError = 'webgl'
      return
    }

    const glCtx = canvas.getContext('webgl2') ?? null
    state.canvas = canvas
    state.renderer = new SkiaRenderer(ck, surface, glCtx)
    editor.setCanvasKit(ck, state.renderer)
    canvas.dataset.ready = '1'

    // When the surface is recreated after a resize fallback, destroyRenderer
    // has cleared the module-level fontProvider — the new renderer must reload.
    // On initial mount, kit-loader.init() handles loadFonts, so skip here.
    if (reloadFonts && !isDestroyed()) {
      void state.renderer.loadFonts(renderNow).then(() => {
        if (!isDestroyed()) renderNow()
        return undefined
      })
    }
  }

  function renderNow() {
    if (!state.renderer || isDestroyed()) return
    state.renderer.renderFromEditorState(
      editor.state,
      editor.graph,
      editor.textEditor,
      canvasRef.value?.clientWidth ?? 0,
      canvasRef.value?.clientHeight ?? 0,
      shouldShowRulers(),
      options?.layer ?? 'full'
    )
    renderLoop.markRendered()
    clearSceneBackingRenderTimer()
    if (options?.layer === 'scene' && state.renderer.sceneBackingNeedsCrispRender) {
      const delay = Math.max(0, state.renderer.sceneBackingPreviewUntil - performance.now())
      sceneBackingRenderTimer = setTimeout(() => renderLoop.markDirty(), delay)
    }
  }

  const renderLoop = createCanvasRenderLoop(editor, renderNow, { layer: options?.layer })

  function resizeCanvas(canvas: HTMLCanvasElement) {
    const ck = getCanvasKit()
    if (!ck || !state.renderer) {
      createSurface(canvas)
      return
    }

    // A resize notification does not always mean new pixels — the observer also fires on
    // layout churn that leaves the backing store identical. Rebuilding the GPU surface and
    // repainting for those is pure waste.
    if (!sizeCanvas(canvas, editor)) return

    // Editor now holds the new viewport size — safe for size-dependent policy (re-fit).
    options?.onResize?.()

    const result = makeGLSurface(ck, canvas, editor, options, state.glContext)
    state.glContext = result.glContext
    const surface = result.surface
    if (!surface) {
      console.warn('Falling back to full surface recreation after resize')
      createSurface(canvas, { reloadFonts: true })
      return
    }
    state.renderer.replaceSurface(surface)
    renderNow()
  }

  function destroy() {
    clearSceneBackingRenderTimer()
    renderLoop.pause()
    if (state.renderer) editor.removeCanvasRenderer(state.renderer)
    state.renderer?.destroy()
    state.glContext?.delete()
    state.glContext = null
    // The component is going away with its canvas, so the context goes too.
    releaseCanvasContext(state.canvas)
    state.canvas = null
    state.renderer = null
  }

  return {
    createSurface,
    resizeCanvas,
    renderNow,
    destroy,
    markDirty: renderLoop.markDirty,
    getRenderer: () => state.renderer
  }
}

export function useCanvasSurfaceLifecycle({
  canvasRef,
  surface,
  setCanvasKit,
  getCanvasKitValue,
  lifecycle,
  onReady,
  resizeMode
}: {
  canvasRef: Ref<HTMLCanvasElement | null>
  surface: ReturnType<typeof createCanvasSurfaceManager>
  setCanvasKit: (ck: CanvasKit | null) => void
  getCanvasKitValue: () => CanvasKit | null
  lifecycle: { destroyed: boolean }
  onReady?: () => void
  resizeMode?: 'live' | 'settle'
}) {
  useCanvasKitLoader({
    canvasRef,
    lifecycle,
    setCanvasKit,
    createSurface: surface.createSurface,
    loadFonts: () => surface.getRenderer()?.loadFonts(surface.renderNow),
    renderNow: surface.renderNow,
    onReady
  })

  useCanvasResizeObserver({
    canvasRef,
    getCanvasKitValue,
    resizeCanvas: surface.resizeCanvas,
    mode: resizeMode
  })

  onScopeDispose(() => {
    lifecycle.destroyed = true
    surface.destroy()
  })
}
