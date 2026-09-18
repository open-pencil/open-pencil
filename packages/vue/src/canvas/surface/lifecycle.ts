import type { CanvasKit } from 'canvaskit-wasm'
import { onScopeDispose } from 'vue'
import type { Ref } from 'vue'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'

import {
  supportsWideGamutPresentation,
  type PresentationColorSpace
} from '#vue/canvas/surface/color-space'
import { makeGLSurface, sizeCanvas, type CanvasGLContext } from '#vue/canvas/surface/gl-surface'
import { useCanvasKitLoader } from '#vue/canvas/surface/kit-loader'
import { createCanvasRenderLoop } from '#vue/canvas/surface/render-loop'
import { useCanvasResizeObserver } from '#vue/canvas/surface/resize-observer'
import type { UseCanvasOptions } from '#vue/canvas/surface/types'

type SurfaceManagerState = {
  renderer: SkiaRenderer | null
  glContext: CanvasGLContext | null
  presentation: PresentationColorSpace | null
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
  const state: SurfaceManagerState = { renderer: null, glContext: null, presentation: null }
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

    sizeCanvas(canvas, editor, options?.onViewportResize)

    const result = makeGLSurface(
      ck,
      canvas,
      options,
      state.glContext,
      editor.graph.documentColorSpace
    )
    state.glContext = result.glContext
    state.presentation = result.presentation
    options?.onPresentation?.(result.presentation)
    const surface = result.surface
    if (!surface) {
      canvas.dataset.surfaceError = 'webgl'
      return
    }

    const glCtx = canvas.getContext('webgl2') ?? null
    state.renderer = new SkiaRenderer(ck, surface, glCtx)
    state.renderer.presentationColorSpace = result.presentation ?? 'srgb'
    state.renderer.tracksSceneSettlement = options?.layer !== 'overlays'
    state.renderer.tiledSceneEnabled = options?.sceneRenderer === 'tiled'
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

  function acknowledgePresentation() {
    const renderedState = options?.getRenderState?.() ?? editor.state
    options?.onPresented?.({
      renderVersion: renderedState.renderVersion,
      sceneVersion: renderedState.sceneVersion
    })
  }

  function renderNow() {
    if (!state.renderer || isDestroyed()) return
    state.renderer.renderFromEditorState(
      options?.getRenderState?.() ?? editor.state,
      editor.graph,
      editor.textEditor,
      canvasRef.value?.clientWidth ?? 0,
      canvasRef.value?.clientHeight ?? 0,
      shouldShowRulers(),
      options?.layer ?? 'full',
      editor.isInteractiveEditing()
    )
    renderLoop.markRendered()
    acknowledgePresentation()
    clearSceneBackingRenderTimer()
    if (options?.layer === 'scene' && state.renderer.tiledScenePending) {
      renderLoop.markDirty()
    }
    if (options?.layer === 'scene' && state.renderer.sceneBackingNeedsCrispRender) {
      const delay = Math.max(0, state.renderer.sceneBackingPreviewUntil - performance.now())
      sceneBackingRenderTimer = setTimeout(() => renderLoop.markDirty(), delay)
    }
  }

  const renderLoop = createCanvasRenderLoop(editor, renderNow, {
    layer: options?.layer,
    getRenderState: options?.getRenderState,
    shouldSuspendRender: options?.shouldSuspendRender
  })

  function resizeCanvas(canvas: HTMLCanvasElement) {
    const ck = getCanvasKit()
    if (!ck || !state.renderer) {
      createSurface(canvas)
      return
    }

    sizeCanvas(canvas, editor, options?.onViewportResize)

    const result = makeGLSurface(
      ck,
      canvas,
      options,
      state.glContext,
      editor.graph.documentColorSpace
    )
    state.glContext = result.glContext
    state.presentation = result.presentation
    options?.onPresentation?.(result.presentation)
    const surface = result.surface
    if (!surface) {
      console.warn('Falling back to full surface recreation after resize')
      createSurface(canvas, { reloadFonts: true })
      return
    }
    state.renderer.presentationColorSpace = result.presentation ?? 'srgb'
    state.renderer.replaceSurface(surface)
    renderNow()
  }

  const wantsWideGamut = () =>
    editor.graph.documentColorSpace === 'display-p3' && supportsWideGamutPresentation()

  /** A P3 document needs the P3 surface, and vice versa; documents arrive after mount. */
  function refreshPresentation() {
    if (isDestroyed()) return
    const canvas = canvasRef.value
    if (!canvas) return
    if (wantsWideGamut() === (state.presentation === 'display-p3')) return
    createSurface(canvas, { reloadFonts: true })
  }

  const stopPresentationRefresh = editor.onEditorEvent('graph:replaced', refreshPresentation)
  const stopColorSpaceRefresh = editor.onEditorEvent(
    'document:color-space-changed',
    refreshPresentation
  )

  function destroy() {
    stopPresentationRefresh()
    stopColorSpaceRefresh()
    clearSceneBackingRenderTimer()
    renderLoop.pause()
    if (state.renderer) editor.removeCanvasRenderer(state.renderer)
    state.renderer?.destroy()
    state.glContext?.delete()
  }

  return {
    createSurface,
    resizeCanvas,
    renderNow,
    destroy,
    markDirty: () => renderLoop.markDirty(),
    getRenderer: () => state.renderer,
    getPresentation: () => state.presentation
  }
}

export function useCanvasSurfaceLifecycle({
  canvasRef,
  surface,
  setCanvasKit,
  getCanvasKitValue,
  lifecycle,
  onReady
}: {
  canvasRef: Ref<HTMLCanvasElement | null>
  surface: ReturnType<typeof createCanvasSurfaceManager>
  setCanvasKit: (ck: CanvasKit | null) => void
  getCanvasKitValue: () => CanvasKit | null
  lifecycle: { destroyed: boolean }
  onReady?: () => void
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

  const { cancelResize } = useCanvasResizeObserver({
    canvasRef,
    getCanvasKitValue,
    resizeCanvas: surface.resizeCanvas
  })

  onScopeDispose(() => {
    lifecycle.destroyed = true
    cancelResize()
    surface.destroy()
  })
}
