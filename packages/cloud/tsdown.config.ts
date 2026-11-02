import { defineConfig } from 'tsdown'

const shared = {
  format: ['esm'] as const,
  dts: true,
  sourcemap: true,
  hash: false,
  outDir: './dist',
  treeshake: { moduleSideEffects: false },
  outputOptions: { minifyInternalExports: false },
  deps: { neverBundle: [/^node:/] }
}

export default defineConfig([
  {
    ...shared,
    name: 'neutral',
    entry: {
      contract: './src/contract/index.ts',
      server: './src/server/index.ts'
    },
    platform: 'neutral',
    clean: true
  },
  {
    ...shared,
    name: 'browser',
    entry: { client: './src/client/index.ts' },
    platform: 'browser',
    clean: false
  },
  {
    ...shared,
    name: 'email',
    entry: { email: './src/email/index.ts' },
    platform: 'neutral',
    clean: false
  },
  {
    ...shared,
    name: 'node',
    entry: {
      'runtime-node': './src/runtime/node/index.ts',
      // The package's commands, `openpencil-cloud` and `openpencil-ai-relay`.
      'bin/server': './src/runtime/node/main.ts',
      'bin/ai-relay': './src/runtime/node/ai-relay/main.ts'
    },
    platform: 'node',
    clean: false
  }
])
