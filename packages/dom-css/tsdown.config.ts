import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    browser: './src/browser.ts',
    'jsx-runtime': './src/jsx/runtime.ts',
    'jsx-dev-runtime': './src/jsx/dev-runtime.ts'
  },
  platform: 'neutral',
  format: ['esm'],
  dts: false,
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: {
    moduleSideEffects: false
  },
  deps: {
    neverBundle: ['@open-pencil/core', /^@open-pencil\/core\//, 'node:fs/promises'],
    onlyBundle: false
  }
})
