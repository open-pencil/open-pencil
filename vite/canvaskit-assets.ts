import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { Connect, Plugin, ResolvedConfig } from 'vite'

function syncWasmFromNodeModules(root: string, source: string, destination: string) {
  const sourcePath = resolve(root, source)
  const destinationPath = resolve(root, destination)
  if (!existsSync(sourcePath)) {
    console.warn(`[copy-canvaskit-wasm] Missing source (run \`bun install\`): ${sourcePath}`)
    return
  }
  mkdirSync(dirname(destinationPath), { recursive: true })
  copyFileSync(sourcePath, destinationPath)
}

function serveCanvasKitWasm(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? ''
    if (pathname !== '/canvaskit.wasm') {
      next()
      return
    }

    const publicPath = resolve(root, pathname.slice(1))
    const fallbackPath = resolve(root, 'node_modules/canvaskit-wasm/bin/canvaskit.wasm')
    const file = existsSync(publicPath) ? publicPath : fallbackPath
    if (!existsSync(file)) {
      next()
      return
    }

    res.setHeader('Content-Type', 'application/wasm')
    res.setHeader('Cache-Control', 'no-cache')
    createReadStream(file).on('error', next).pipe(res)
  }
}

export function copyCanvasKitAssetsPlugin(): Plugin {
  let root = process.cwd()

  return {
    name: 'copy-canvaskit-wasm',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      root = config.root
    },
    buildStart() {
      syncWasmFromNodeModules(
        root,
        'node_modules/canvaskit-wasm/bin/canvaskit.wasm',
        'public/canvaskit.wasm'
      )
    },
    configureServer(server) {
      server.middlewares.use(serveCanvasKitWasm(server.config.root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveCanvasKitWasm(server.config.root))
    }
  }
}
