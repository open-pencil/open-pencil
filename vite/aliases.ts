import { resolve } from 'node:path'

export function createInklyAliases(rootDir: string) {
  const emptyNodeModule = resolve(rootDir, 'vite/empty-node-module.ts')

  return {
    fs: emptyNodeModule,
    path: emptyNodeModule,
    '@': resolve(rootDir, 'src'),
    '#vue': resolve(rootDir, 'packages/vue/src'),
    '#core': resolve(rootDir, 'packages/core/src'),
    '@inkly/vue': resolve(rootDir, 'packages/vue/src'),
    '@inkly/core': resolve(rootDir, 'packages/core/src'),
    'opentype.js': resolve(rootDir, 'node_modules/opentype.js/dist/opentype.module.js'),
    mermaid: resolve(rootDir, 'src/app/shell/markdown/index.ts'),
    'beautiful-mermaid': resolve(rootDir, 'src/app/shell/markdown/index.ts')
  }
}
