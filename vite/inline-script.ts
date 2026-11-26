import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build, type Plugin } from 'vite'

import { viteBuildTarget } from '../src/app/shell/support/baseline.ts'
import { createOpenPencilAliases } from './aliases.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
/** `?script` among an id's query, which Vite extends, as with `?t=…&script` after a hot update. */
const SCRIPT_QUERY = /[?&]script(?:&|$)/
/** `?script-file`, the same script loaded from its own file in a build. */
const SCRIPT_FILE_QUERY = /[?&]script-file(?:&|$)/

/** An id without its query, as Vite's own `cleanUrl`. */
const withoutQuery = (id: string) => id.replace(/[?#].*$/s, '')

/**
 * `import source from './entry.ts?script'`: the module and everything it imports bundled into
 * one classic script, as a string. It is for code that can run only inline, such as the code
 * panel's sandbox, whose opaque-origin frame can start a worker only from a `blob:` URL. Vite's
 * `?worker&inline` inlines only in a build, so the script is bundled the same way in dev and in
 * a build, as Vite bundles an inline worker, and minified in a build.
 *
 * `import script from './entry.ts?script-file'` is the same script for a page to load: in a build
 * it is a file of its own, `{ src }`, so the page carries no inline script and a content security
 * policy can allow only the app's own files; in development, where no policy applies, `{ text }`
 * (as the boot splash, `vite/boot-splash`).
 */
export function inlineScriptPlugin(): Plugin {
  return {
    name: 'open-pencil-inline-script',
    load: {
      filter: { id: [SCRIPT_QUERY, SCRIPT_FILE_QUERY] },
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
        if (!SCRIPT_FILE_QUERY.test(id)) {
          return { code: `export default ${JSON.stringify(chunk.code)}`, map: null }
        }
        if (this.environment.config.command !== 'build') {
          return { code: `export default { text: ${JSON.stringify(chunk.code)} }`, map: null }
        }
        const reference = this.emitFile({
          type: 'asset',
          name: `${basename(entry).replace(/\.[^.]+$/, '')}.js`,
          source: chunk.code
        })
        return {
          code: `export default { src: import.meta.ROLLUP_FILE_URL_${reference} }`,
          map: null
        }
      }
    }
  }
}
