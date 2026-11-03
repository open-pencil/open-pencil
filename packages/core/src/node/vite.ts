import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

/**
 * The module that points Core at the files the plugin serves. The plugin adds it to the page
 * unless `inject` is off; an app that loads Core later, behind a gate of its own, imports it
 * before Core loads anything.
 */
export const OPEN_PENCIL_ASSETS_MODULE = 'virtual:open-pencil/assets'

const RESOLVED_ASSETS_MODULE = `\0${OPEN_PENCIL_ASSETS_MODULE}`
const FONT_FILE = /\.(?:ttf|otf|woff2?)$/

export interface OpenPencilPluginOptions {
  /**
   * Adds the assets module to `index.html` ahead of the app's own scripts (default `true`).
   * Turn it off to import `virtual:open-pencil/assets` yourself, as an app without an
   * `index.html` must.
   */
  inject?: boolean
}

function packageFile(specifier: string): string {
  return fileURLToPath(import.meta.resolve(specifier))
}

/** Every font file Core ships: the bundled faces and the stand-ins it may load by file name. */
function bundledFontFiles(): Map<string, string> {
  const assets = new URL('assets/', import.meta.resolve('@open-pencil/core/package.json'))
  return new Map(
    readdirSync(assets)
      .filter((file) => FONT_FILE.test(file))
      .map((file) => [file, fileURLToPath(new URL(file, assets))])
  )
}

/**
 * The assets module's source: each file is imported as a `?url` asset, so Vite serves it in
 * development and emits it, hashed and under `base`, with the build; then Core's locators get
 * the URLs. CanvasKit's binary comes from the copy Core loads its JavaScript from, so the two
 * always match.
 */
function assetsModule(): string {
  const fonts = [...bundledFontFiles()]
  const lines = [
    `import canvasKit from ${JSON.stringify(`${packageFile('canvaskit-wasm/bin/full/canvaskit.wasm')}?url`)}`,
    `import harfBuzzSubset from ${JSON.stringify(`${packageFile('harfbuzzjs/dist/harfbuzz-subset.wasm')}?url`)}`,
    ...fonts.map(([, path], index) => `import font${index} from ${JSON.stringify(`${path}?url`)}`),
    `import { setCanvasKitLocator } from '@open-pencil/core/canvaskit'`,
    `import { fontManager, setHarfBuzzSubsetLocator } from '@open-pencil/core/text'`,
    `const fonts = { ${fonts.map(([file], index) => `${JSON.stringify(file)}: font${index}`).join(', ')} }`,
    `setCanvasKitLocator(() => canvasKit)`,
    `setHarfBuzzSubsetLocator(() => harfBuzzSubset)`,
    `fontManager.setBundledFontLocator((file) => fonts[file] ?? '/' + file)`
  ]
  return `${lines.join('\n')}\n`
}

/**
 * Serves the files OpenPencil's engine loads at run time, CanvasKit's WebAssembly, the bundled
 * fonts, and HarfBuzz's subsetter, and points Core at them, so an app that uses `@open-pencil/core`
 * or `@open-pencil/vue` needs no setup of its own beyond adding this plugin.
 */
export function openPencil(options: OpenPencilPluginOptions = {}): Plugin {
  const inject = options.inject ?? true
  return {
    name: 'open-pencil:assets',
    resolveId(id) {
      return id === OPEN_PENCIL_ASSETS_MODULE ? RESOLVED_ASSETS_MODULE : undefined
    },
    load(id) {
      return id === RESOLVED_ASSETS_MODULE ? assetsModule() : undefined
    },
    transformIndexHtml: {
      // Before Vite's own pass, which bundles the script with the page's in a build.
      order: 'pre',
      handler() {
        if (!inject) return []
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import ${JSON.stringify(OPEN_PENCIL_ASSETS_MODULE)}`,
            injectTo: 'head-prepend'
          }
        ]
      }
    }
  }
}
