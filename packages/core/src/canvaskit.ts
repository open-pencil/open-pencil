import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'

let instance: CanvasKit | null = null

export type GpuBackend = 'webgl' | 'webgpu'

let activeBackend: GpuBackend = 'webgl'

export function getGpuBackend(): GpuBackend {
  return activeBackend
}

export interface CanvasKitOptions {
  locateFile?: (file: string) => string
  backend?: GpuBackend
}

function detectBackend(): GpuBackend {
  if (typeof window === 'undefined') return 'webgl'
  const params = new URLSearchParams(window.location.search)
  if (params.get('gpu') === 'webgpu' && 'gpu' in navigator) return 'webgpu'
  return 'webgl'
}

function loadCanvasKitWebGPU(): Promise<(opts?: Record<string, unknown>) => Promise<CanvasKit>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/canvaskit-webgpu/canvaskit.js'
    script.onload = () => {
      const init = 'CanvasKitInit' in globalThis
        ? ((globalThis as typeof globalThis & { CanvasKitInit: unknown }).CanvasKitInit as (opts?: { locateFile?: (file: string) => string }) => Promise<CanvasKit>)
        : null
      if (!init) return reject(new Error('CanvasKitInit not found after loading WebGPU build'))
      resolve(init)
    }
    script.onerror = () => reject(new Error('Failed to load canvaskit-webgpu/canvaskit.js'))
    document.head.appendChild(script)
  })
}

export async function getCanvasKit(options?: CanvasKitOptions): Promise<CanvasKit> {
  if (instance) return instance

  const backend = options?.backend ?? detectBackend()
  activeBackend = backend

  const defaultLocate = (file: string) => {
    if (typeof window !== 'undefined') return `/${file}`
    return file
  }

  if (backend === 'webgpu') {
    const init = await loadCanvasKitWebGPU()
    instance = await init({
      locateFile:
        options?.locateFile ??
        ((file: string) => `/canvaskit-webgpu/${file}`)
    })
  } else {
    instance = await CanvasKitInit({
      locateFile: options?.locateFile ?? defaultLocate
    })
  }

  return instance
}
