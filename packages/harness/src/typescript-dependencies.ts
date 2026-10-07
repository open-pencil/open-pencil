import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * `@ai-sdk/harness-pi` imports `pi-mcp-adapter`, which publishes TypeScript sources, and Node
 * refuses to strip types under `node_modules`. Strip them for TypeScript dependencies only, so
 * Pi sessions with MCP servers start under Node; Bun runs TypeScript itself.
 */
export function loadTypeScriptDependencies(): void {
  if (process.versions.bun) return
  // Read at runtime so Node versions without these APIs still start the companion.
  const { registerHooks, stripTypeScriptTypes } = process.getBuiltinModule('node:module')
  if (typeof registerHooks !== 'function' || typeof stripTypeScriptTypes !== 'function') return
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:') || !url.endsWith('.ts') || !url.includes('/node_modules/')) {
        return nextLoad(url, context)
      }
      const source = readFileSync(fileURLToPath(url), 'utf8')
      // The first call announces the experimental API on stderr, which reads as a problem in hosts.
      const emitWarning = process.emitWarning.bind(process)
      process.emitWarning = () => undefined
      try {
        return {
          format: 'module',
          source: stripTypeScriptTypes(source, { mode: 'transform' }),
          shortCircuit: true
        }
      } finally {
        process.emitWarning = emitWarning
      }
    }
  })
}
