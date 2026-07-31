import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
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
    neverBundle: [
      '@open-pencil/kiwi',
      /^@open-pencil\/kiwi\//,
      '@open-pencil/scene-graph',
      /^@open-pencil\/scene-graph\//,
      /^node:/
    ],
    onlyBundle: false
  }
})
