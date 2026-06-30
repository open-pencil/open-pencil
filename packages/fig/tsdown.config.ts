import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
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
    onlyBundle: false
  },
  outputOptions: {
    minifyInternalExports: false
  }
})
