import process from 'node:process'

import { injectCloudBootstrap, parseCloudDiscovery } from '#cloud/contract'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  const proxyTarget = process.env.OPENPENCIL_CLOUD_DEV_PROXY
  const bootstrapPlugin = {
    name: 'openpencil-cloud-development-bootstrap',
    apply: 'serve' as const,
    async transformIndexHtml(html: string) {
      if (!proxyTarget) {
        throw new Error('OPENPENCIL_CLOUD_DEV_PROXY is required to serve the Cloud application')
      }
      const response = await fetch(new URL('/.well-known/openpencil', proxyTarget))
      if (!response.ok) throw new Error(`Cloud discovery failed with HTTP ${response.status}`)
      return injectCloudBootstrap(html, parseCloudDiscovery(await response.json()))
    }
  }
  return {
    root: new URL('.', import.meta.url).pathname,
    base: '/',
    plugins: [
      vue(),
      Icons({ compiler: 'vue3' }),
      Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
      tailwindcss(),
      bootstrapPlugin
    ],
    build: {
      outDir: '../dist/admin',
      emptyOutDir: true
    },
    server:
      command === 'serve' && proxyTarget
        ? { proxy: { '/api': proxyTarget, '/.well-known': proxyTarget } }
        : undefined,
    resolve: {
      conditions: ['openpencil-source'],
      alias: [{ find: '#admin', replacement: new URL('./src', import.meta.url).pathname }]
    }
  }
})
