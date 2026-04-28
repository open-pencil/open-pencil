import raw from 'unplugin-raw/rolldown'
import vue from 'unplugin-vue/rolldown'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
  },
  platform: 'neutral',
  format: ['esm'],
  dts: {
    vue: true,
    sourcemap: true,
    resolver: 'tsc'
  },
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: {
    moduleSideEffects: false
  },
  deps: {
    neverBundle: [
      'vue',
      /^vue\//,
      '@open-pencil/core',
      /^@open-pencil\/core\//,
      'canvaskit-wasm',
      'opentype.js',
      '@vueuse/core',
      '@nanostores/vue',
      '@nanostores/i18n',
      'nanostores',
      '@tanstack/vue-table',
      'reka-ui',
      '@atlaskit/pragmatic-drag-and-drop',
      /^@atlaskit\/pragmatic-drag-and-drop\//,
      '@atlaskit/pragmatic-drag-and-drop-hitbox',
      /^@atlaskit\/pragmatic-drag-and-drop-hitbox\//
    ],
    onlyBundle: false
  },
  plugins: [raw(), vue()],
  inputOptions: {
    preserveEntrySignatures: 'allow-extension',
    checks: {
      pluginTimings: false
    }
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
            const file = srcIndex >= 0 ? parts.slice(srcIndex + 1).join('/') : parts.at(-1) ?? 'index'
            return file.replace(/\.(vue|ts)$/, '')
          }
        }
      ]
    }
  }
})
