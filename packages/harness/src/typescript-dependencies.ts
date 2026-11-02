import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { transformSync } from 'amaro'

/**
 * `@ai-sdk/harness-pi` imports `pi-mcp-adapter`, which publishes TypeScript sources, and Node
 * refuses to strip types under `node_modules`. Transform them for TypeScript dependencies only, so
 * Pi sessions with MCP servers start under Node; Bun runs TypeScript itself. The adapter uses
 * parameter properties, which need Amaro's transform mode: Node 26 only strips types.
 */
export function loadTypeScriptDependencies(): void {
  if (process.versions.bun) return
  // Read at runtime so Node versions without module hooks still start the companion.
  const { registerHooks } = process.getBuiltinModule('node:module')
  if (typeof registerHooks !== 'function') return
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:') || !url.endsWith('.ts') || !url.includes('/node_modules/')) {
        return nextLoad(url, context)
      }
      const source = readFileSync(fileURLToPath(url), 'utf8')
      return {
        format: 'module',
        source: transformSync(source, { mode: 'transform' }).code,
        shortCircuit: true
      }
    }
  })
}
