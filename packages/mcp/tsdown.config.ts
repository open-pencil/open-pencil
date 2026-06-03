import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    server: './src/server.ts',
    stdio: './src/stdio.ts'
  },
  platform: 'node',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: './dist',
  treeshake: false,
  deps: {
    neverBundle: [
      '@hono/node-server',
      '@modelcontextprotocol/sdk',
      '@inkly/core',
      /^@inkly\/core\//,
      'hono',
      /^hono\//,
      'package-manager-detector',
      /^package-manager-detector\//,
      'ws',
      'zod',
      /^node:/
    ],
    onlyBundle: false
  }
})
