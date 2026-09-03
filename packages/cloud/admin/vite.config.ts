import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: '/',
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: '../dist/admin',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '#admin': new URL('./src', import.meta.url).pathname,
      '@open-pencil/ui': new URL('../../ui/src/index.ts', import.meta.url).pathname
    }
  }
})
