import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import type { Alias, Plugin, PluginOption } from 'vite'

import rootManifest from '../package.json' with { type: 'json' }
import { createOpenPencilAliases } from './aliases.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE_ROOT = fileURLToPath(new URL('../src/', import.meta.url))

const RAW_TEXT_PREFIX = '\0app-raw-text:'
// The virtual id must not end in `.md`, or a VitePress host renders the module as a page.
const RAW_TEXT_SUFFIX = '.js'
const RAW_TEXT_EXTENSIONS = ['.md', '.kiwi']

/**
 * The app imports Markdown and Kiwi schemas as strings (`raw-markdown.ts`). A host that
 * treats `.md` as pages, such as VitePress, would compile them instead, so app-side text
 * imports resolve to a virtual module before the host's own transforms see them.
 */
function appRawText(): Plugin {
  return {
    name: 'open-pencil-app-raw-text',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !RAW_TEXT_EXTENSIONS.some((extension) => source.endsWith(extension))) {
        return null
      }
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved?.id.startsWith(SOURCE_ROOT)) return null
      return `${RAW_TEXT_PREFIX}${resolved.id}${RAW_TEXT_SUFFIX}`
    },
    async load(id) {
      if (!id.startsWith(RAW_TEXT_PREFIX)) return null
      const file = id.slice(RAW_TEXT_PREFIX.length, -RAW_TEXT_SUFFIX.length)
      return `export default ${JSON.stringify(await readFile(file, 'utf8'))}`
    }
  }
}

export interface AppSourceConfig {
  alias: Alias[]
  define: Record<string, string>
  plugins: PluginOption[]
}

/**
 * What another Vite host needs to compile the app's components from source: the app's
 * aliases, its icon plugins, its text imports, and the build-time constants it reads. The
 * host has no local automation server, so those constants are empty.
 */
export function appSourceConfig(): AppSourceConfig {
  return {
    alias: createOpenPencilAliases(REPO_ROOT),
    define: {
      __OPENPENCIL_APP_VERSION__: JSON.stringify(rootManifest.version),
      __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__: JSON.stringify(''),
      __OPENPENCIL_LOCAL_AUTOMATION_URL__: JSON.stringify(''),
      __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__: JSON.stringify('')
    },
    plugins: [
      appRawText(),
      Icons({ compiler: 'vue3' }),
      Components({ dirs: [], dts: false, resolvers: [IconsResolver({ prefix: 'icon' })] })
    ]
  }
}
