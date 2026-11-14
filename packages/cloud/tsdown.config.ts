import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

const shared = {
  format: ['esm'] as const,
  // The emails are Vue single-file components, compiled here and declared through vue-tsc.
  dts: { vue: true },
  plugins: [vue()],
  sourcemap: true,
  hash: false,
  outDir: './dist',
  treeshake: { moduleSideEffects: false },
  outputOptions: { minifyInternalExports: false },
  deps: { neverBundle: [/^node:/, /^cloudflare:/] }
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
    // What a Cloudflare Worker imports, so Wrangler bundles compiled code and no `.vue` files.
    name: 'cloudflare',
    entry: { 'runtime-cloudflare': './src/runtime/cloudflare/index.ts' },
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
