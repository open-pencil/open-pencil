import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'instance-overrides': './src/instance-overrides/index.ts',
    clipboard: './src/clipboard/index.ts',
    'node-change': './src/node-change/index.ts'
  },
  platform: 'neutral',
  format: ['esm'],
  dts: true,
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
