import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin, ResolvedConfig } from 'vite'

/**
 * The Cloud portal builds without the editor's public directory (fonts, CanvasKit, demo files)
 * and copies only the brand artwork, which components load from `/brand/`.
 */
export function cloudPortalBrandPlugin(): Plugin {
  let config: ResolvedConfig | undefined
  return {
    name: 'open-pencil-cloud-portal-brand',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    writeBundle() {
      if (!config) return
      cpSync(resolve(config.root, 'public/brand'), resolve(config.build.outDir, 'brand'), {
        recursive: true
      })
    }
  }
}
