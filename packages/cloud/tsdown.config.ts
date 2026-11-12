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
      // The PostHog error reporter alone, for services that report as Cloud does without its server.
      errors: './src/errors/index.ts',
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
      // The package's commands, `openpencil-cloud` and `openpencil-services`.
      'bin/server': './src/runtime/node/main.ts',
      'bin/services': './src/runtime/node/services/main.ts'
    },
    platform: 'node',
    clean: false
  }
])
