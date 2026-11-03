import type { Plugin } from 'vite'

/** The module that points Core at the files Vite serves (`runtime-assets/install.ts`). */
const RUNTIME_ASSETS_MODULE = '@open-pencil/core/runtime-assets/install'

export interface OpenPencilPluginOptions {
  /**
   * Adds the setup module to `index.html` ahead of the app's own scripts (default `true`). Turn
   * it off to import `@open-pencil/core/runtime-assets/install` yourself, as an app without an
   * `index.html`, or one that loads Core behind a gate of its own, does.
   */
  inject?: boolean
}

/**
 * Serves the files OpenPencil's engine loads at run time, CanvasKit's WebAssembly, the bundled
 * fonts, and HarfBuzz's subsetter, and points Core at them, so an app that uses
 * `@open-pencil/core` or `@open-pencil/vue` needs no setup of its own beyond adding this plugin.
 */
export function openPencil(options: OpenPencilPluginOptions = {}): Plugin {
  const inject = options.inject ?? true
  return {
    name: 'open-pencil:assets',
    // The module is pre-bundled like the rest of Core, so it sets the locators on the copy of
    // Core the app imports; Vite's pre-bundling keeps its `?url` imports for its asset handling.
    transformIndexHtml: {
      // Before Vite's own pass, which bundles the script with the page's in a build.
      order: 'pre',
      handler() {
        if (!inject) return []
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import ${JSON.stringify(RUNTIME_ASSETS_MODULE)}`,
            injectTo: 'head-prepend'
          }
        ]
      }
    }
  }
}
