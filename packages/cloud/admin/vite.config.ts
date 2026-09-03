import process from 'node:process'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => {
  const proxyTarget = process.env.OPENPENCIL_CLOUD_DEV_PROXY
  return {
    root: new URL('.', import.meta.url).pathname,
    base: '/',
    plugins: [
      vue(),
      Icons({ compiler: 'vue3' }),
      Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
      tailwindcss()
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
