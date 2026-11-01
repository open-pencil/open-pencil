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

function hmrOptions(host: string | undefined, hmrURL: string | undefined): ServerOptions['hmr'] {
  if (!hmrURL) return host ? { protocol: 'ws', host, port: 1421 } : undefined
  const url = new URL(hmrURL)
  const secure = url.protocol === 'https:'
  return {
    protocol: secure ? 'wss' : 'ws',
    host: url.hostname,
    clientPort: Number(url.port || (secure ? 443 : 80))
  }
}

/**
 * `hmrURL` is the server's own public address, for pages another server serves: the Cloud server
 * forwards their files here in `cloud:dev` but not WebSockets, so updates connect here directly.
 */
export function createDevServerOptions(
  host: string | undefined,
  rootDir: string,
  hmrURL?: string
): ServerOptions {
  return {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: hmrOptions(host, hmrURL),
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
