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
    alwaysBundle: ['@open-pencil/mcp', /^@open-pencil\/mcp\//],
    neverBundle: ['@open-pencil/core', /^@open-pencil\/core\//, 'canvaskit-wasm', /^node:/],
    onlyBundle: false
  }
})
