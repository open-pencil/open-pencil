import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    copy: './src/copy.ts',
    'node-defaults': './src/node-defaults.ts',
    'hit-test': './src/hit-test.ts',
    images: './src/images.ts',
    instances: './src/instances.ts',
    snap: './src/snap.ts',
    'source-metadata': './src/source-metadata.ts',
    preview: './src/preview.ts',
    'text-picture': './src/text-picture.ts',
    undo: './src/undo.ts',
    variables: './src/variables.ts',
    'variant-name': './src/variant-name.ts',
    'vector-network': './src/vector-network.ts',
    types: './src/types.ts',
    primitives: './src/primitives.ts',
    constants: './src/constants.ts',
    coordinate: './src/coordinate.ts',
    matrix: './src/matrix.ts',
    geometry: './src/geometry.ts',
    resize: './src/resize.ts',
    'parse-path': './src/parse-path.ts'
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
    neverBundle: [/^node:/],
    onlyBundle: false
  },
  outputOptions: {
    minifyInternalExports: false,
    codeSplitting: {
      groups: [
        {
          test: /(?<!\.d\.c?ts)$/,
          name: (id) => {
            const cleanId = id.split('?')[0]
            const parts = cleanId.split(/[\\/]/g)
            const srcIndex = parts.lastIndexOf('src')
            const file = srcIndex >= 0 ? parts.slice(srcIndex + 1).join('/') : parts.at(-1) ?? 'chunk'
            return `chunks/${file.replace(/\.(ts|tsx)$/, '')}`
          }
        }
      ]
    }
  }
})
