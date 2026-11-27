import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { KitDefinition } from './kit'
import type { RenderReply } from './react/worker'

export type { KitDefinition } from './kit'

/**
 * Renders the kit's page from its own components as a browser shows it once mounted, in a worker
 * whose realm holds the browser's globals and ends with the render.
 */
export async function renderKitPage(kit: KitDefinition): Promise<string> {
  const worker = new Worker(new URL('react/worker.ts', import.meta.url))
  try {
    const reply = await new Promise<RenderReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<RenderReply>) => resolve(event.data)
      worker.onerror = (event) => reject(new Error(event.message))
      // A worker takes no target origin; an empty transfer list is its second argument.
      worker.postMessage(kit, { transfer: [] })
    })
    if ('error' in reply) throw new Error(`Could not render ${kit.name}: ${reply.error}`)
    return reply.html
  } finally {
    worker.terminate()
  }
}

/** The kit's stylesheet compiled for the classes the page uses, as Tailwind builds it for a site. */
export async function compileKitStylesheet(kit: KitDefinition, html: string): Promise<string> {
  const candidates = new Scanner({}).scanFiles([{ content: html, extension: 'html' }])
  const compiler = await compile(await Bun.file(kit.stylesheet).text(), {
    base: dirname(kit.stylesheet),
    // The kit is built once, so nothing watches the files the stylesheet reads.
    onDependency: () => undefined,
    shouldRewriteUrls: true
  })
  return compiler.build(candidates)
}

/** Draws the kit: its page rendered, styled in each of its modes, and imported with components. */
export async function buildKitGraph(kit: KitDefinition): Promise<SceneGraph> {
  const html = await renderKitPage(kit)
  const cssText = await compileKitStylesheet(kit, html)
  const { graph } = await readHTMLDocument(html, {
    cssText,
    // The stylesheet's URLs, such as its fonts', are relative to it.
    baseURL: pathToFileURL(`${dirname(kit.stylesheet)}/`).href,
    pageName: kit.name,
    components: true,
    variables: { collection: kit.name, modes: kit.modes }
  })
  return graph
}

/** The kit as a `.fig` file, as the gallery publishes it. */
export async function buildKit(kit: KitDefinition): Promise<Uint8Array> {
  return exportFigFile(await buildKitGraph(kit))
}
