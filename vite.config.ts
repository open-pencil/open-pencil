import { resolve } from 'path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST

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
      buildStart() {
        const src = 'node_modules/canvaskit-wasm/bin/canvaskit.wasm'
        const dest = 'public/canvaskit.wasm'
        if (existsSync(src) && !existsSync(dest)) {
          copyFileSync(src, dest)
        }

        const webgpuSrc = 'packages/core/vendor/canvaskit-webgpu/canvaskit.wasm'
        const webgpuDir = 'public/canvaskit-webgpu'
        const webgpuDest = `${webgpuDir}/canvaskit.wasm`
        if (existsSync(webgpuSrc) && !existsSync(webgpuDest)) {
          mkdirSync(webgpuDir, { recursive: true })
          copyFileSync(webgpuSrc, webgpuDest)
        }

        const webgpuJsSrc = 'packages/core/vendor/canvaskit-webgpu/canvaskit.js'
        const webgpuJsDest = `${webgpuDir}/canvaskit.js`
        if (existsSync(webgpuJsSrc) && !existsSync(webgpuJsDest)) {
          mkdirSync(webgpuDir, { recursive: true })
          copyFileSync(webgpuJsSrc, webgpuJsDest)
        }
      }
    },
    tailwindcss(),
    Icons({ compiler: 'vue3' }),
    Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,wasm,png,ico,ttf,webmanifest}'],
        navigateFallback: '/index.html'
      },
      manifest: {
        name: 'OpenPencil',
        short_name: 'OpenPencil',
        description: 'Open-source design editor',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        categories: ['design', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
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
