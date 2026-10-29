import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin, ResolvedConfig } from 'vite'

/**
 * The metrics dashboard builds without the editor's public directory (fonts, CanvasKit, demo
 * files) and copies only the brand artwork, which components load from `/brand/`. `site` is the
 * folder served at the site's root, when the page itself lives below it.
 */
export function metricsBrandPlugin(site?: (outDir: string) => string): Plugin {
  let config: ResolvedConfig | undefined
  return {
    name: 'open-pencil-metrics-brand',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    writeBundle() {
      if (!config) return
      const outDir = resolve(config.root, config.build.outDir)
      cpSync(resolve(config.root, 'public/brand'), resolve(site?.(outDir) ?? outDir, 'brand'), {
        recursive: true
      })
    }
  }
}
