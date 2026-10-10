import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { server: './src/runtime/node/main.ts' },
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
        '#cloud': new URL('./src', import.meta.url).pathname
      }
    }
  }
})
