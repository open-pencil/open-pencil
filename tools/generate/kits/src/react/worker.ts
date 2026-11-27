/**
 * Renders a kit's page in a realm of its own: it gives itself a browser's globals, loads the page
 * through Vite with the marked Radix, mounts it, and posts the markup back.
 */
import type { ReactElement } from 'react'
import { createServer } from 'vite'

import { COMPONENT_ATTRIBUTES } from '@open-pencil/dom-css/scene-graph'

import { createKitMarks, type KitDefinition, type KitMarks } from '../kit'
import { installBrowserGlobals, mountedMarkup } from './mount'
import { markedRadixPlugin } from './radix'

/** What the worker posts back: the page's markup, or why it could not render it. */
export type RenderReply = { html: string } | { error: string }

type KitPage = { default: (marks: KitMarks) => ReactElement }

function isKitPage(module: Record<string, unknown>): module is KitPage {
  return typeof module.default === 'function'
}

async function render(kit: KitDefinition): Promise<string> {
  const server = await createServer({
    root: kit.root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    // Kits are React; the repository's own TypeScript settings keep JSX for Vue.
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    plugins: [markedRadixPlugin()],
    // Radix is served through the plugin rather than loaded as a package of its own.
    ssr: { noExternal: ['radix-ui'] }
  })
  try {
    // Primitives check for a document as they load, so the page loads after the globals.
    installBrowserGlobals()
    const page = await server.ssrLoadModule(kit.page)
    if (!isKitPage(page)) throw new Error(`${kit.page} draws no page`)
    return await mountedMarkup(page.default(createKitMarks(COMPONENT_ATTRIBUTES)))
  } finally {
    await server.close()
  }
}

self.onmessage = async (event: MessageEvent<KitDefinition>) => {
  const reply: RenderReply = await render(event.data).then(
    (html) => ({ html }),
    (error: unknown) => ({
      error: error instanceof Error ? (error.stack ?? error.message) : String(error)
    })
  )
  postMessage(reply)
}
