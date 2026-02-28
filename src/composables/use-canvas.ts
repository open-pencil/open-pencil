import { useResizeObserver } from '@vueuse/core'
import { onMounted, onUnmounted, watch, type Ref } from 'vue'

import { getCanvasKit } from '../engine/canvaskit'
import { SkiaRenderer } from '../engine/renderer'

import type { EditorStore } from '../stores/editor'
import type { CanvasKit } from 'canvaskit-wasm'

export function useCanvas(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  let renderer: SkiaRenderer | null = null
  let ck: CanvasKit | null = null
  let destroyed = false

  async function init() {
    const canvas = canvasRef.value
    if (!canvas || destroyed) return

    ck = await getCanvasKit()
    if (destroyed) return

    await new Promise((r) => requestAnimationFrame(r))
    createSurface(canvas)
  }

  function createSurface(canvas: HTMLCanvasElement) {
    if (!ck) return

    renderer?.destroy()
    renderer = null

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr

    const surface = ck.MakeWebGLCanvasSurface(canvas, undefined, { preserveDrawingBuffer: 1 })
    if (!surface) {
      console.error('Failed to create WebGL surface')
      return
    }

    renderer = new SkiaRenderer(ck, surface)
    store.setCanvasKit(ck, renderer)
    renderer.loadFonts().then(() => renderNow())
    renderNow()
    canvas.dataset.ready = '1'
  }

  let rafId = 0

  function renderNow() {
    if (!renderer) return
    renderer.dpr = window.devicePixelRatio || 1
    renderer.panX = store.state.panX
    renderer.panY = store.state.panY
    renderer.zoom = store.state.zoom
    renderer.viewportWidth = canvasRef.value?.clientWidth ?? 0
    renderer.viewportHeight = canvasRef.value?.clientHeight ?? 0
    renderer.showRulers = !new URLSearchParams(window.location.search).has('no-rulers')
    renderer.pageColor = store.state.pageColor
    renderer.pageId = store.state.currentPageId
    renderer.render(store.graph, store.state.selectedIds, {
      hoveredNodeId: store.state.hoveredNodeId,
      editingTextId: store.state.editingTextId,
      marquee: store.state.marquee,
      snapGuides: store.state.snapGuides,
      rotationPreview: store.state.rotationPreview,
      dropTargetId: store.state.dropTargetId,
      layoutInsertIndicator: store.state.layoutInsertIndicator,
      penState: store.state.penState ? {
        ...store.state.penState,
        cursorX: store.state.penCursorX ?? undefined,
        cursorY: store.state.penCursorY ?? undefined
      } : null
    })
  }

  function render() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      renderNow()
    })
  }

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    destroyed = true
    cancelAnimationFrame(rafId)
    cancelAnimationFrame(resizeRaf)
    renderer?.destroy()
  })

  let resizeRaf = 0
  useResizeObserver(canvasRef, () => {
    const canvas = canvasRef.value
    if (!canvas || !ck || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      createSurface(canvas)
    })
  })

  watch(
    () => store.state.renderVersion,
    () => render()
  )

  watch(
    () => store.state.selectedIds,
    () => render()
  )

  function hitTestSectionTitle(canvasX: number, canvasY: number) {
    return renderer?.hitTestSectionTitle(store.graph, canvasX, canvasY) ?? null
  }

  function hitTestComponentLabel(canvasX: number, canvasY: number) {
    return renderer?.hitTestComponentLabel(store.graph, canvasX, canvasY) ?? null
  }

  return { render, hitTestSectionTitle, hitTestComponentLabel }
}
