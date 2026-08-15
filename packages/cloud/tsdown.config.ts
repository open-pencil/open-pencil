import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    contract: './src/contract/index.ts',
    client: './src/client/index.ts',
    email: './src/email/index.ts',
    'runtime-cloudflare': './src/runtime/cloudflare/index.ts',
    'runtime-node': './src/runtime/node/index.ts',
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
  outputOptions: {
    minifyInternalExports: false
  }
})
