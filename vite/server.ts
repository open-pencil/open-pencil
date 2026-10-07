import { resolve } from 'node:path'

import { normalizePath, type ServerOptions } from 'vite'

const WATCHED_MARKDOWN_ROOTS = ['/src/', '/packages/core/src/', '/packages/vue/src/']

function ignoreMarkdownOutsideSource(path: string): boolean {
  const normalized = normalizePath(path)
  if (!normalized.endsWith('.md')) return false
  return !WATCHED_MARKDOWN_ROOTS.some((root) => normalized.includes(root))
}

export const WATCH_IGNORED = [
  '**/desktop/**',
  '**/packages/cli/**',
  '**/packages/mcp/**',
  '**/packages/docs/**',
  '**/tests/**',
  '**/.github/**',
  '**/.pi/**',
  ignoreMarkdownOutsideSource
]

export function createDevServerOptions(host: string | undefined, rootDir: string): ServerOptions {
  return {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    // Vite forwards browser logs to the terminal when an agent starts it. Vue warnings carry the
    // component's props, and serializing the editor state behind them freezes the tab, so only
    // errors are forwarded.
    forwardConsole: { unhandledErrors: true, logLevels: ['error'] },
    watch: {
      // Ignore nested checkouts, not an active checkout whose own path contains .worktrees.
      ignored: [...WATCH_IGNORED, `${normalizePath(resolve(rootDir, '.worktrees'))}/**`]
    }
  }
}
