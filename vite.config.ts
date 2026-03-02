import { resolve } from 'path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST
// @ts-expect-error process is a nodejs global
const enableWebGPU = process.env.WEBGPU === '1'

export default defineConfig(async () => ({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      shiki: resolve(__dirname, 'src/shims/shiki.ts')
    }
  },
  plugins: [
    {
      name: 'copy-canvaskit-wasm',
      async buildStart() {
        const src = 'node_modules/canvaskit-wasm/bin/canvaskit.wasm'
        const dest = 'public/canvaskit.wasm'
        if (existsSync(src) && !existsSync(dest)) {
          copyFileSync(src, dest)
        }

        if (enableWebGPU) {
          const webgpuDir = 'public/canvaskit-webgpu'
          if (!existsSync(`${webgpuDir}/canvaskit.wasm`)) {
            mkdirSync(webgpuDir, { recursive: true })
            const tag = 'v0.1.0-webgpu'
            const base = `https://github.com/open-pencil/skia/releases/download/${tag}`
            console.log(`Downloading CanvasKit WebGPU from ${base}...`)
            for (const file of ['canvaskit.js', 'canvaskit.wasm']) {
              const resp = await fetch(`${base}/${file}`)
              if (!resp.ok) throw new Error(`Failed to download ${file}: ${resp.status}`)
              writeFileSync(`${webgpuDir}/${file}`, Buffer.from(await resp.arrayBuffer()))
            }
            console.log('CanvasKit WebGPU downloaded.')
          }
        }
      }
    },
    tailwindcss(),
    Icons({ compiler: 'vue3' }),
    Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
    vue()
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: [
        '**/desktop/**',
        '**/packages/cli/**',
        '**/packages/mcp/**',
        '**/packages/docs/**',
        '**/tests/**',
        '**/openspec/**',
        '**/.worktrees/**',
        '**/.github/**',
        '**/.pi/**'
      ]
    }
  }
}))
