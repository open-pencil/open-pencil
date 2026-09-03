import vue from 'unplugin-vue/rolldown'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  platform: 'browser',
  format: ['esm'],
  dts: { vue: true, sourcemap: true, resolver: 'tsc' },
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: { moduleSideEffects: false },
  deps: {
    neverBundle: ['vue', /^vue\//, 'tailwind-variants'],
    onlyBundle: false
  },
  plugins: [vue()],
  inputOptions: {
    preserveEntrySignatures: 'allow-extension',
    checks: { pluginTimings: false }
  },
  outputOptions: { minifyInternalExports: false }
})
