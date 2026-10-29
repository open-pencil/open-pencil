import { fileURLToPath } from 'node:url'

import { build, type Plugin } from 'vite'

import { viteBuildTarget } from '../src/app/shell/support/baseline.ts'
import { createOpenPencilAliases } from './aliases.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
/** `?script` among an id's query, which Vite extends, as with `?t=…&script` after a hot update. */
const SCRIPT_QUERY = /[?&]script(?:&|$)/

/** An id without its query, as Vite's own `cleanUrl`. */
const withoutQuery = (id: string) => id.replace(/[?#].*$/s, '')

/**
 * `import source from './entry.ts?script'`: the module and everything it imports bundled into
 * one classic script, as a string. It is for code that can run only inline, such as the code
 * panel's sandbox, whose opaque-origin frame can start a worker only from a `blob:` URL. Vite's
 * `?worker&inline` inlines only in a build, so the script is bundled the same way in dev and in
 * a build, as Vite bundles an inline worker, and minified in a build.
 */
export function inlineScriptPlugin(): Plugin {
  return {
    name: 'open-pencil-inline-script',
    load: {
      filter: { id: SCRIPT_QUERY },
      async handler(id) {
        const entry = withoutQuery(id)
        const result = await build({
          configFile: false,
          root: REPO_ROOT,
          publicDir: false,
          logLevel: 'warn',
          resolve: { alias: createOpenPencilAliases(REPO_ROOT) },
          // An entry may itself inline another, as the sandbox frame inlines its worker.
          plugins: [inlineScriptPlugin()],
          build: {
            write: false,
            minify: this.environment.config.command === 'build',
            target: viteBuildTarget(),
            emptyOutDir: false,
            copyPublicDir: false,
            lib: { entry, formats: ['iife'], name: 'openPencilInlineScript' }
          }
        })
        // One IIFE entry builds one chunk, which comes first.
        const [output] = [result].flat()
        const chunk = 'output' in output ? output.output[0] : undefined
        if (!chunk) throw new Error(`Could not bundle ${entry} as a script`)
        for (const moduleId of chunk.moduleIds) {
          if (!moduleId.startsWith('\0')) this.addWatchFile(withoutQuery(moduleId))
        }
        return { code: `export default ${JSON.stringify(chunk.code)}`, map: null }
      }
    }
  }
}
