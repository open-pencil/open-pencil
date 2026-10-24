import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    server: './src/runtime/node/main.ts',
    'ai-relay': './src/runtime/node/ai-relay/main.ts'
  },
  platform: 'node',
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: './dist-standalone',
  target: 'node22',
  deps: { alwaysBundle: [/.*/], neverBundle: [/^node:/] },
  inputOptions: {
    resolve: {
      alias: {
        '#cloud': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
