import { readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { build, type Plugin, type ResolvedConfig } from 'vite'

type Compiled = {
  script: string
  style: string
  /** Every source the script and stylesheet were built from, to rebuild when one changes. */
  sources: string[]
}

export type BootSplashOptions = {
  /** The script that starts the page in its theme; it imports the splash's stylesheet. */
  entry: string
  /**
   * The app's pages, by file name, that draw the splash. Other pages Vite builds with this
   * config, such as Storybook's, are left as they are.
   */
  pages: readonly string[]
}

/** Builds the script and its stylesheet with the app's own aliases and browser targets. */
async function compile(config: ResolvedConfig, entry: string): Promise<Compiled> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    root: config.root,
    publicDir: false,
    resolve: { alias: config.resolve.alias },
    build: {
      write: false,
      target: config.build.target,
      cssTarget: config.build.cssTarget,
      minify: true,
      cssCodeSplit: false,
      modulePreload: false,
      rolldownOptions: { input: entry, output: { format: 'iife' } }
    }
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  const chunk = outputs.find((file) => file.type === 'chunk')
  const style = outputs.find((file) => file.type === 'asset' && file.fileName.endsWith('.css'))
  if (chunk?.type !== 'chunk' || style?.type !== 'asset') {
    throw new Error(`The boot splash (${entry}) must build to one script and one stylesheet`)
  }
  const script = chunk.code.trim()
  // Inlined as is, the script must not close its own tag.
  if (script.includes('</script')) throw new Error('The boot splash script cannot be inlined')
  return { script, style: String(style.source).trim(), sources: chunk.moduleIds }
}

/**
 * Draws one boot splash on each of the app's pages, with its stylesheet and the script that starts
 * the page in its theme, all inlined so they show before anything loads. The stylesheet and script
 * are built by Vite from `entry`, minified and lowered to the app's browser targets.
 */
export function bootSplashPlugin({ entry, pages }: BootSplashOptions): Plugin {
  let config: ResolvedConfig | undefined
  let compiled: Promise<Compiled> | null = null
  // The sources of the last build that worked, kept through one that failed, so fixing the
  // failing edit rebuilds; before any build has worked, the splash's own folder.
  let sources: readonly string[] = []
  const current = () => {
    if (!config) throw new Error('The boot splash plugin ran before Vite resolved its config')
    compiled ??= compile(config, entry).then(
      (result) => {
        sources = result.sources
        return result
      },
      (error: unknown) => {
        compiled = null
        throw error
      }
    )
    return compiled
  }
  // What to watch now: the last working build's sources, or every file in the splash's folder.
  const watched = () =>
    sources.length > 0
      ? sources
      : readdirSync(dirname(entry)).map((name) => join(dirname(entry), name))
  const changed = (file: string) => {
    const source = sources.length > 0 ? sources.includes(file) : file.startsWith(dirname(entry))
    if (source) compiled = null
    return source
  }
  return {
    name: 'open-pencil-boot-splash',
    configResolved(resolved) {
      config = resolved
    },
    // `vite build --watch` rebuilds the pages when a source of the splash changes.
    async buildStart() {
      for (const source of watched()) this.addWatchFile(source)
      for (const source of (await current()).sources) this.addWatchFile(source)
    },
    watchChange(id) {
      changed(id)
    },
    // The dev server reloads the page instead, since the splash only draws on a fresh load.
    configureServer(server) {
      server.watcher.add(watched())
      current()
        .then((result) => server.watcher.add(result.sources))
        .catch((error: unknown) => server.config.logger.error(`Boot splash: ${String(error)}`))
      server.watcher.on('change', (file) => {
        if (changed(file)) server.ws.send({ type: 'full-reload' })
      })
    },
    transformIndexHtml: {
      async handler(html, { filename }) {
        if (!pages.includes(basename(filename))) return html
        const { script, style } = await current()
        return [
          { tag: 'style', children: style, injectTo: 'head' },
          { tag: 'script', children: script, injectTo: 'head' },
          // After the page's mount element, so the stylesheet hides it once the app draws there.
          {
            tag: 'div',
            attrs: { id: 'boot-splash', role: 'status', 'aria-label': 'Loading' },
            children: [{ tag: 'div', attrs: { class: 'bar' } }],
            injectTo: 'body'
          }
        ]
      }
    }
  }
}
