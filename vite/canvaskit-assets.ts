import { copyFileSync, existsSync, mkdirSync } from 'fs'

import type { Plugin } from 'vite'

function copyIfMissing(source: string, destination: string) {
  if (!existsSync(source) || existsSync(destination)) return
  const directory = destination.slice(0, destination.lastIndexOf('/'))
  if (directory) mkdirSync(directory, { recursive: true })
  copyFileSync(source, destination)
}

export function copyCanvasKitAssetsPlugin(): Plugin {
  return {
    name: 'copy-canvaskit-wasm',
    buildStart() {
      copyIfMissing('node_modules/canvaskit-wasm/bin/canvaskit.wasm', 'public/canvaskit.wasm')
      copyIfMissing(
        'packages/core/vendor/canvaskit-webgpu/canvaskit.wasm',
        'public/canvaskit-webgpu/canvaskit.wasm',
      )
      copyIfMissing(
        'packages/core/vendor/canvaskit-webgpu/canvaskit.js',
        'public/canvaskit-webgpu/canvaskit.js',
      )
    },
  }
}
