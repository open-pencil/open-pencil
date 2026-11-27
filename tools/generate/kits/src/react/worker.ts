/**
 * Renders a kit's page in a realm of its own: it gives itself a browser's globals, loads the page
 * and the kit's modules through Vite with the marked Radix, mounts it, and posts the markup back.
 */
import { realpath, rm, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ReactElement } from 'react'
import { createServer } from 'vite'

import { COMPONENT_ATTRIBUTES } from '@open-pencil/dom-css/scene-graph'

import {
  createKitMarks,
  type KitAbout,
  type KitMarks,
  type KitModules,
  type KitSources
} from '../kit'
import { installBrowserGlobals, mountedMarkup } from './mount'
import { markedRadixPlugin } from './radix'

/** The packages the page, the kit, and the mount must share one copy of. */
const REACT = ['react', 'react-dom'] as const

/** What the worker is asked to render: the page module and the kit's installed sources. */
export interface RenderRequest {
  page: string
  sources: KitSources
}

/** What the worker posts back: the page's markup, or why it could not render it. */
export type RenderReply = { html: string } | { error: string }

type KitPage = {
  default: (marks: KitMarks, modules: KitModules, about: KitAbout) => ReactElement
}

function isKitPage(module: Record<string, unknown>): module is KitPage {
  return typeof module.default === 'function'
}

/**
 * Points the kit's project at this React, which its own install also brought: the page, the
 * kit's modules, and the mount must share one, and a package Node loads finds it by folder.
 */
async function shareReact(project: string): Promise<void> {
  for (const name of REACT) {
    const own = join(project, 'node_modules', name)
    const shared = dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)))
    if ((await realpath(own).catch(() => null)) === (await realpath(shared))) continue
    await rm(own, { recursive: true, force: true })
    await symlink(shared, own, 'dir')
  }
}

async function render({ page, sources }: RenderRequest): Promise<string> {
  await shareReact(sources.root)
  const server = await createServer({
    root: import.meta.dir,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: sources.aliases },
    // Kits are React; the repository's own TypeScript settings keep JSX for Vue.
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    plugins: [markedRadixPlugin()],
    // Radix is served through the plugin rather than loaded as a package of its own.
    ssr: { noExternal: ['radix-ui'] }
  })
  try {
    // Primitives check for a document as they load, so the page loads after the globals.
    installBrowserGlobals()
    const modules: Record<string, Record<string, unknown>> = {}
    for (const [name, path] of Object.entries(sources.modules)) {
      modules[name] = await server.ssrLoadModule(path)
    }
    const drawn = await server.ssrLoadModule(page)
    if (!isKitPage(drawn)) throw new Error(`${page} draws no page`)
    const about: KitAbout = { installer: sources.installer, docs: sources.docs }
    const marks = createKitMarks(COMPONENT_ATTRIBUTES)
    return await mountedMarkup(drawn.default(marks, modules, about))
  } finally {
    await server.close()
  }
}

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const reply: RenderReply = await render(event.data).then(
    (html) => ({ html }),
    (error: unknown) => ({
      error: error instanceof Error ? (error.stack ?? error.message) : String(error)
    })
  )
  postMessage(reply)
}
