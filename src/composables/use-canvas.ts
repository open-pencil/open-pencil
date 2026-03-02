import { useRafFn, useResizeObserver } from '@vueuse/core'
import { onMounted, onUnmounted, type Ref } from 'vue'

import { getCanvasKit, getGpuBackend } from '@/engine/canvaskit'
import { SkiaRenderer } from '@/engine/renderer'

import type { EditorStore } from '@/stores/editor'
import type { CanvasKit, Surface } from 'canvaskit-wasm'

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

/**
 * Graphite requires a fresh SkSurface wrapping the current swapchain texture each frame.
 * This proxy implements the Surface interface but creates a real surface on getCanvas()
 * and disposes it on flush(), transparent to the renderer.
 */
function makeWebGPUSurfaceProxy(ck: CanvasKit, canvasCtx: unknown): Surface {
  const gpu = asWebGPU(ck)
  let frameSurface: Surface | null = null

  return {
    getCanvas() {
      if (frameSurface) {
        frameSurface.delete()
        frameSurface = null
      }
      frameSurface = gpu.MakeGPUCanvasSurface(canvasCtx, ck.ColorSpace.SRGB)
      if (!frameSurface) {
        console.error('[WebGPU] MakeGPUCanvasSurface returned null')
        throw new Error('Failed to create WebGPU frame surface')
      }
      return frameSurface.getCanvas()
    },
    flush() {
      if (frameSurface) {
        frameSurface.flush()
        frameSurface = null
        // Don't dispose — let the swapchain texture live until next getCanvas()
      }
    },
    reportBackendTypeIsGPU: () => true,
    width: () => 0,
    height: () => 0,
    delete() {
      frameSurface?.dispose()
      frameSurface = null
    },
    dispose() {
      frameSurface?.dispose()
      frameSurface = null
    },
    isDeleted: () => false
  } as unknown as Surface
}

export function useCanvas(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  let renderer: SkiaRenderer | null = null
  let ck: CanvasKit | null = null
  let gpuCtx: WebGPUContext | null = null
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

  function createSurface(canvas: HTMLCanvasElement) {
    if (!ck) return

    renderer?.destroy()
    renderer = null

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr

    let surface
    if (getGpuBackend() === 'webgpu' && gpuCtx) {
      const gpu = asWebGPU(ck)
      const canvasCtx = gpu.MakeGPUCanvasContext(gpuCtx.deviceContext, canvas)
      if (!canvasCtx) {
        console.error('Failed to create WebGPU canvas context')
        return
      }
      surface = makeWebGPUSurfaceProxy(ck, canvasCtx)
    } else {
      const isTest = new URLSearchParams(window.location.search).has('test')
      surface = ck.MakeWebGLCanvasSurface(
        canvas,
        undefined,
        isTest ? { preserveDrawingBuffer: 1 } : undefined
      )
      if (!surface) {
        console.error('Failed to create WebGL surface')
        return
      }
    }

    renderer = new SkiaRenderer(ck, surface)
    store.setCanvasKit(ck, renderer)
    renderer.loadFonts().then(() => renderNow())
    renderNow()
    canvas.dataset.ready = '1'
  }

  const params = new URLSearchParams(window.location.search)
  const showRulers = !params.has('no-rulers')

  function renderNow() {
    if (!renderer) return
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
