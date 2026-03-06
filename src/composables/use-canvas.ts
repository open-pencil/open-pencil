import { useRafFn, useResizeObserver } from '@vueuse/core'
import { onMounted, onUnmounted, type Ref } from 'vue'

import { getCanvasKit, getGpuBackend } from '@/engine/canvaskit'
import { SkiaRenderer } from '@/engine/renderer'

import type { EditorStore } from '@/stores/editor'
import type { CanvasKit } from 'canvaskit-wasm'

interface WebGPUContext {
  device: GPUDevice
  deviceContext: unknown
}

interface CanvasKitWebGPU {
  MakeGPUDeviceContext(device: GPUDevice): unknown
  MakeGPUCanvasContext(ctx: unknown, canvas: HTMLCanvasElement, opts?: unknown): unknown
  MakeGPUCanvasSurface(
    ctx: unknown,
    colorSpace?: unknown,
    width?: number,
    height?: number
  ): ReturnType<CanvasKit['MakeSurface']>
}

function asWebGPU(ck: CanvasKit): CanvasKitWebGPU {
  return ck as unknown as CanvasKitWebGPU
}

async function initWebGPU(ck: CanvasKit): Promise<WebGPUContext | null> {
  if (!('gpu' in navigator)) return null
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()
  const deviceContext = asWebGPU(ck).MakeGPUDeviceContext?.(device)
  if (!deviceContext) return null
  return { device, deviceContext }
}

export function useCanvas(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  let renderer: SkiaRenderer | null = null
  let ck: CanvasKit | null = null
  let gpuCtx: WebGPUContext | null = null
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

    if (getGpuBackend() === 'webgpu') {
      gpuCtx = await initWebGPU(ck)
      if (!gpuCtx) {
        console.warn('WebGPU init failed, reload without ?gpu=webgpu to use WebGL')
        return
      }
    }

    await new Promise((r) => requestAnimationFrame(r))
    createSurface(canvas)

    const loader = document.getElementById('loader')
    if (loader) {
      loader.classList.add('fade-out')
      setTimeout(() => loader.remove(), 300)
    }
  }

  function sizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
  }

  function makeGLSurface(canvas: HTMLCanvasElement) {
    if (!ck) return null
    if (!glContext) {
      const isTest = new URLSearchParams(window.location.search).has('test')
      const glAttrs = isTest ? { preserveDrawingBuffer: 1 } : undefined
      const handle = ck.GetWebGLContext(canvas, glAttrs)
      if (!handle) return null
      glContext = ck.MakeGrContext(handle)
    }
    if (!glContext) return null
    return ck.MakeOnScreenGLSurface(glContext, canvas.width, canvas.height, ck.ColorSpace.SRGB)
  }

  function createSurface(canvas: HTMLCanvasElement) {
    if (!ck) return

    renderer?.destroy()
    renderer = null
    glContext?.delete()
    glContext = null

    sizeCanvas(canvas)

    let surface
    if (getGpuBackend() === 'webgpu' && gpuCtx) {
      const gpu = asWebGPU(ck)
      const canvasCtx = gpu.MakeGPUCanvasContext(gpuCtx.deviceContext, canvas)
      surface = gpu.MakeGPUCanvasSurface(canvasCtx, ck.ColorSpace.SRGB, canvas.width, canvas.height)
      if (!surface) {
        console.error('Failed to create WebGPU surface')
        return
      }
    } else {
      surface = makeGLSurface(canvas)
      if (!surface) {
        console.error('Failed to create WebGL surface')
        return
      }
    }

    const glCtx = (canvas.getContext('webgl2') ?? null) as WebGL2RenderingContext | null
    renderer = new SkiaRenderer(ck, surface, glCtx)
    store.setCanvasKit(ck, renderer)
    renderer.loadFonts().then(() => renderNow())
    renderNow()
    canvas.dataset.ready = '1'
  }

  const params = new URLSearchParams(window.location.search)
  const noRulersParam = params.has('no-rulers')
  const mobileQuery = matchMedia('(max-width: 767px)')
  let showRulers = !noRulersParam && !mobileQuery.matches
  mobileQuery.addEventListener('change', (e) => {
    showRulers = !noRulersParam && !e.matches
    dirty = true
  })

  function renderNow() {
    if (!renderer || destroyed) return
    renderer.dpr = window.devicePixelRatio || 1
    renderer.panX = store.state.panX
    renderer.panY = store.state.panY
    renderer.zoom = store.state.zoom
    renderer.viewportWidth = canvasRef.value?.clientWidth ?? 0
    renderer.viewportHeight = canvasRef.value?.clientHeight ?? 0
    renderer.showRulers = showRulers
    renderer.pageColor = store.state.pageColor
    renderer.pageId = store.state.currentPageId
    renderer.render(
      store.graph,
      store.state.selectedIds,
      {
        hoveredNodeId: store.state.hoveredNodeId,
        editingTextId: store.state.editingTextId,
        textEditor: store.textEditor,
        marquee: store.state.marquee,
        snapGuides: store.state.snapGuides,
        rotationPreview: store.state.rotationPreview,
        dropTargetId: store.state.dropTargetId,
        layoutInsertIndicator: store.state.layoutInsertIndicator,
        penState: store.state.penState
          ? {
              ...store.state.penState,
              cursorX: store.state.penCursorX ?? undefined,
              cursorY: store.state.penCursorY ?? undefined
            }
          : null,
        remoteCursors: store.state.remoteCursors.length > 0 ? store.state.remoteCursors : undefined
      },
      store.state.sceneVersion
    )
    lastRenderVersion = store.state.renderVersion
    lastSelectedIds = store.state.selectedIds
  }

  const { pause } = useRafFn(() => {
    const versionChanged = store.state.renderVersion !== lastRenderVersion
    const selectionChanged = store.state.selectedIds !== lastSelectedIds
    if (dirty || versionChanged || selectionChanged) {
      dirty = false
      renderNow()
    }
  })

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
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
      createSurface(canvas)
      return
    }
    renderer.replaceSurface(surface)
    renderNow()
  }

  function hitTestSectionTitle(canvasX: number, canvasY: number) {
    return renderer?.hitTestSectionTitle(store.graph, canvasX, canvasY) ?? null
  }

  function hitTestComponentLabel(canvasX: number, canvasY: number) {
    return renderer?.hitTestComponentLabel(store.graph, canvasX, canvasY) ?? null
  }

  return {
    render: () => {
      dirty = true
    },
    hitTestSectionTitle,
    hitTestComponentLabel
  }
}
