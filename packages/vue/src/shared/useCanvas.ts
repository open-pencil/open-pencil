import { useRafFn, useResizeObserver } from '@vueuse/core'
import { onMounted, onScopeDispose, type Ref } from 'vue'

import { getCanvasKit, SkiaRenderer } from '@open-pencil/core'

import { useViewportKind } from '../viewport/useViewportKind'

import type { Editor } from '@open-pencil/core/editor'
import type { CanvasKit } from 'canvaskit-wasm'

/**
 * Options for {@link useCanvas}.
 */
export interface UseCanvasOptions {
  /**
   * Forces ruler visibility on or off for this canvas.
   *
   * When omitted, the composable falls back to viewport and URL-param logic.
   */
  showRulers?: boolean
  /**
   * Keeps the drawing buffer after presenting frames.
   *
   * Useful for screenshot or pixel-readback workflows, but may increase memory
   * usage depending on the browser and GPU backend.
   */
  preserveDrawingBuffer?: boolean
  /**
   * Called once the rendering surface is ready.
   */
  onReady?: () => void
}

/**
 * Connects an OpenPencil editor to a real canvas element using CanvasKit.
 *
 * This composable owns renderer creation, surface recreation on resize,
 * render scheduling, and renderer-backed hit testing helpers used by higher-
 * level canvas interaction code.
 */
export function useCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options?: UseCanvasOptions
) {
  let renderer: SkiaRenderer | null = null
  let ck: CanvasKit | null = null
  let glContext: ReturnType<CanvasKit['MakeGrContext']> | null = null
  let destroyed = false
  let dirty = true
  let lastRenderVersion = -1
  let lastSelectedIds: Set<string> | null = null

  async function init() {
    const canvas = canvasRef.value
    if (!canvas || destroyed) return

    ck = await getCanvasKit()
    if (destroyed) return

    await new Promise((r) => requestAnimationFrame(r))
    createSurface(canvas)
    await renderer?.loadFonts()
    if (!destroyed) renderNow()
  }

  function sizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    const maybeSizedEditor = editor as Editor & {
      setViewportSize?: (width: number, height: number) => void
    }
    maybeSizedEditor.setViewportSize?.(canvas.clientWidth, canvas.clientHeight)
  }

  function makeGLSurface(canvas: HTMLCanvasElement) {
    if (!ck) return null
    if (!glContext) {
      const glAttrs = options?.preserveDrawingBuffer ? { preserveDrawingBuffer: 1 } : undefined
      const handle = ck.GetWebGLContext(canvas, glAttrs)
      if (!handle) return null
      glContext = ck.MakeGrContext(handle)
    }
    if (!glContext) return null

    const preferredSpace = editor.graph.documentColorSpace
    const colorSpaces =
      preferredSpace === 'display-p3'
        ? [ck.ColorSpace.DISPLAY_P3, ck.ColorSpace.SRGB]
        : [ck.ColorSpace.SRGB]

    for (const colorSpace of colorSpaces) {
      const surface = ck.MakeOnScreenGLSurface(glContext, canvas.width, canvas.height, colorSpace)
      if (surface) return surface
    }

    return null
  }

  function createSurface(canvas: HTMLCanvasElement) {
    if (!ck) return

    renderer?.destroy()
    renderer = null
    glContext?.delete()
    glContext = null

    sizeCanvas(canvas)

    const surface = makeGLSurface(canvas)
    if (!surface) {
      console.error('Failed to create WebGL surface')
      return
    }

    const glCtx = canvas.getContext('webgl2') ?? null
    renderer = new SkiaRenderer(ck, surface, glCtx)
    editor.setCanvasKit(ck, renderer)
    canvas.dataset.ready = '1'
    options?.onReady?.()
  }

  const params =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
  const noRulersParam = params.has('no-rulers')
  const { isMobile } = useViewportKind()

  function shouldShowRulers() {
    if (options?.showRulers === false) return false
    return !noRulersParam && !isMobile.value
  }

  function renderNow() {
    if (!renderer || destroyed) return
    renderer.renderFromEditorState(
      editor.state,
      editor.graph,
      editor.textEditor,
      canvasRef.value?.clientWidth ?? 0,
      canvasRef.value?.clientHeight ?? 0,
      shouldShowRulers()
    )
    lastRenderVersion = editor.state.renderVersion
    lastSelectedIds = editor.state.selectedIds
  }

  const { pause } = useRafFn(() => {
    if (editor.state.loading) return
    const versionChanged = editor.state.renderVersion !== lastRenderVersion
    const selectionChanged = editor.state.selectedIds !== lastSelectedIds
    if (dirty || versionChanged || selectionChanged) {
      dirty = false
      renderNow()
    }
  })

  onMounted(() => {
    void init()
  })

  onScopeDispose(() => {
    destroyed = true
    pause()
    cancelAnimationFrame(resizeRaf)
    renderer?.destroy()
    glContext?.delete()
  })

  let resizeRaf = 0
  useResizeObserver(canvasRef, () => {
    const canvas = canvasRef.value
    if (!canvas || !ck || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      resizeCanvas(canvas)
    })
  })

  function resizeCanvas(canvas: HTMLCanvasElement) {
    if (!ck || !renderer) {
      createSurface(canvas)
      return
    }

    sizeCanvas(canvas)

    const surface = makeGLSurface(canvas)
    if (!surface) {
      console.warn('Falling back to full surface recreation after resize')
      createSurface(canvas)
      return
    }
    renderer.replaceSurface(surface)
    renderNow()
  }

  function hitTestSectionTitle(canvasX: number, canvasY: number) {
    return renderer?.hitTestSectionTitle(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestComponentLabel(canvasX: number, canvasY: number) {
    return renderer?.hitTestComponentLabel(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestFrameTitle(canvasX: number, canvasY: number) {
    return (
      renderer?.hitTestFrameTitle(editor.graph, canvasX, canvasY, editor.state.selectedIds) ?? null
    )
  }

  return {
    render: () => {
      dirty = true
    },
    renderNow,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  }
}
