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
  dts: true,
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
