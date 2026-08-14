import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    contract: './src/contract/index.ts',
    client: './src/client/index.ts',
    server: './src/server/index.ts'
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
      'better-auth',
      /^better-auth\//,
      'hono',
      /^hono\//,
      'jose',
      'kysely',
      /^kysely\//,
      'pg',
      'valibot'
    ],
    onlyBundle: false
  },
  outputOptions: {
    minifyInternalExports: false
  }
})
