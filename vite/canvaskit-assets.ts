import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'fs'
import { resolve } from 'node:path'

import type { Connect } from 'vite'
import type { Plugin } from 'vite'

/** Always copy when source exists so public/ never keeps a stale or empty wasm. */
function syncWasmFromNodeModules(source: string, destination: string) {
  if (!existsSync(source)) {
    console.warn(`[copy-canvaskit-wasm] Missing source (run \`bun install\`): ${source}`)
    return
  }
  const directory = destination.slice(0, destination.lastIndexOf('/'))
  if (directory) mkdirSync(directory, { recursive: true })
  copyFileSync(source, destination)
}

function serveCanvasKitWasm(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathname = req.url?.split('?')[0] ?? ''
    if (pathname !== '/canvaskit.wasm' && pathname !== '/canvaskit-webgpu/canvaskit.wasm') {
      next()
      return
    }

    const publicPath = resolve(root, pathname.slice(1))
    const fallbackPath =
      pathname === '/canvaskit.wasm'
        ? resolve(root, 'node_modules/canvaskit-wasm/bin/canvaskit.wasm')
        : resolve(root, 'packages/core/vendor/canvaskit-webgpu/canvaskit.wasm')

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
  return {
    name: 'copy-canvaskit-wasm',
    enforce: 'pre',
    buildStart() {
      syncWasmFromNodeModules('node_modules/canvaskit-wasm/bin/canvaskit.wasm', 'public/canvaskit.wasm')
      syncWasmFromNodeModules(
        'packages/core/vendor/canvaskit-webgpu/canvaskit.wasm',
        'public/canvaskit-webgpu/canvaskit.wasm',
      )
      syncWasmFromNodeModules(
        'packages/core/vendor/canvaskit-webgpu/canvaskit.js',
        'public/canvaskit-webgpu/canvaskit.js',
      )
    },
    configureServer(server) {
      server.middlewares.use(serveCanvasKitWasm(process.cwd()))
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveCanvasKitWasm(process.cwd()))
    },
  }
}
