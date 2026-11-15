import { readFileSync } from 'node:fs'
import nodeModule from 'node:module'

const RAW_QUERY = '?raw'

/**
 * Loads `<file>?raw` imports as their text, as Vite and Bun do. Playwright runs specs in Node,
 * whose loader would otherwise parse the file, such as a core shader, as JavaScript. Hooks
 * registered later run first, so this one answers before Playwright's own TypeScript loader,
 * which uses the same in-thread hooks.
 */
export function registerRawImports() {
  // Absent before Node 22.15, where the types still declare it.
  const { registerHooks } = nodeModule as Partial<typeof nodeModule>
  if (!registerHooks) {
    throw new Error(`Browser tests need Node 22.15 or later; this is ${process.version}`)
  }
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:') || !url.endsWith(RAW_QUERY)) return nextLoad(url, context)
      const source = readFileSync(new URL(url.slice(0, -RAW_QUERY.length)), 'utf8')
      return {
        format: 'module',
        source: `export default ${JSON.stringify(source)}`,
        shortCircuit: true
      }
    }
  })
}
