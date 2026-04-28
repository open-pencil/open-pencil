import { defineConfig } from 'tsdown'
import type { Plugin } from 'rolldown'

function rawMd(): Plugin {
  return {
    name: 'raw-md',
    transform(code, id) {
      if (id.endsWith('.md')) {
        return { code: `export default ${JSON.stringify(code)}`, map: null }
      }
    }
  }
}

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.d.ts'],
  plugins: [rawMd()],
  unbundle: true,
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  deps: {
    neverBundle: [
      '@iconify/utils',
      'canvaskit-wasm',
      'culori',
      'diff',
      'expr-eval',
      'fflate',
      'fontoxpath',
      'fzstd',
      'nanoevents',
      'opentype.js',
      'sucrase',
      'svgpath',
      'yoga-layout',
      /^node:/
    ],
    onlyBundle: false
  }
})
