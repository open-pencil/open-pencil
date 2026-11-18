import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

export default defineConfig({
  entry: {
    server: './src/runtime/node/main.ts',
    services: './src/runtime/node/services/main.ts'
  },
  platform: 'node',
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: './dist-standalone',
  target: 'node22',
  deps: { alwaysBundle: [/.*/], neverBundle: [/^node:/] },
  plugins: [vue()],
  inputOptions: {
    resolve: {
      alias: {
        '#cloud': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
