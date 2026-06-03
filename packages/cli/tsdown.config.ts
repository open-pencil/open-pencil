import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
  },
  platform: 'node',
  format: ['esm'],
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    neverBundle: ['@inkly/core', /^@inkly\/core\//, 'canvaskit-wasm', /^node:/],
    onlyBundle: false
  }
})
