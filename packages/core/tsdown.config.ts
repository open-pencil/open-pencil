import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.d.ts'],
  unbundle: true,
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  external: [
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
  ]
})
