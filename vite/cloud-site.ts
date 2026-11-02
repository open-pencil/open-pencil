import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin, ResolvedConfig } from 'vite'

/**
 * A Cloud server routes its own pages, so the site it serves leaves out the static host's
 * `_redirects`, which would send every missing file, and every server page, to the editor.
 */
export function cloudSitePlugin(): Plugin {
  let config: ResolvedConfig | undefined
  return {
    name: 'open-pencil-cloud-site',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    writeBundle() {
      if (!config) return
      rmSync(resolve(config.root, config.build.outDir, '_redirects'), { force: true })
    }
  }
}
