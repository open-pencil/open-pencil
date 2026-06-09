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
  deps: {
    neverBundle: [
      'better-auth',
      /^better-auth\//,
      '@better-auth/drizzle-adapter',
      /^@better-auth\//,
      'drizzle-orm',
      /^drizzle-orm\//,
      'hono',
      /^hono\//,
      'jose',
      /^jose\//,
      /^node:/,
      'resend',
      'zod'
    ],
    onlyBundle: false
  }
})
