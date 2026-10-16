/// <reference types="vite/client" />
import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'

import { IS_BROWSER } from './constants'

let instance: CanvasKit | null = null

export interface CanvasKitOptions {
  locateFile?: (file: string) => string
}

/** Local path of a `file:` URL; keeps Windows drive and network-share paths free of the doubled prefix. */
export function fileURLToPath(url: string | URL): string {
  const { hostname, pathname } = new URL(url)
  const path = decodeURIComponent(pathname)
  if (hostname) return `//${hostname}${path}`
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
}

export async function getCanvasKit(options?: CanvasKitOptions): Promise<CanvasKit> {
  if (instance) return instance

  const defaultLocate = (file: string) => {
    if (!IS_BROWSER) {
      const ckPath = import.meta.resolve('canvaskit-wasm')
      return fileURLToPath(new URL(file, ckPath))
    }
    const base = 'env' in import.meta ? import.meta.env.BASE_URL : '/'
    const prefix = base === '/' ? '' : base.replace(/\/$/, '')
    return `${prefix}/${file}`
  }

  instance = await CanvasKitInit({
    locateFile: options?.locateFile ?? defaultLocate
  })

  return instance
}
