import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { PAGE_PREFIX, type KitDefinition, type KitSources } from './kit'
import type { RenderReply, RenderRequest } from './react/worker'

export type { KitDefinition } from './kit'

/**
 * Renders the kit's page from its own components as a browser shows it once mounted, in a worker
 * whose realm holds the browser's globals and ends with the render.
 */
export async function renderKitPage(kit: KitDefinition, sources: KitSources): Promise<string> {
  const worker = new Worker(new URL('react/worker.ts', import.meta.url))
  try {
    const reply = await new Promise<RenderReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<RenderReply>) => resolve(event.data)
      worker.onerror = (event) => reject(new Error(event.message))
      // A worker takes no target origin; an empty transfer list is its second argument.
      const request: RenderRequest = { page: kit.page, sources }
      worker.postMessage(request, { transfer: [] })
    })
    if ('error' in reply) throw new Error(`Could not render ${kit.name}: ${reply.error}`)
    return reply.html
  } finally {
    worker.terminate()
  }
}

/** The kit's stylesheet compiled for the classes the page uses, as Tailwind builds it for a site. */
export async function compileKitStylesheet(sources: KitSources, html: string): Promise<string> {
  const candidates = new Scanner({}).scanFiles([{ content: html, extension: 'html' }])
  const compiler = await compile(await Bun.file(sources.stylesheet).text(), {
    base: dirname(sources.stylesheet),
    // The kit is built once, so nothing watches the files the stylesheet reads.
    onDependency: () => undefined,
    shouldRewriteUrls: true
  })
  return compiler.build(candidates)
}

/**
 * Draws the kit: its page rendered from its installed sources, styled in each of its modes, and
 * imported with components. The page is named after what installed them.
 */
export async function buildKitGraph(kit: KitDefinition): Promise<SceneGraph> {
  const sources = await kit.sources()
  const html = await renderKitPage(kit, sources)
  const cssText = await compileKitStylesheet(sources, html)
  const { graph } = await readHTMLDocument(html, {
    cssText,
    // The stylesheet's URLs, such as its fonts', are relative to it.
    baseURL: pathToFileURL(`${dirname(sources.stylesheet)}/`).href,
    components: true,
    variables: { collection: kit.name, modes: kit.modes }
  })
  splitPages(graph)
  return graph
}

/**
 * Moves each layer the page marked as a page of its own onto a page of that name, in the order
 * the page drew them, and removes the page they were imported on once nothing else is left.
 */
function splitPages(graph: SceneGraph): void {
  const [imported] = graph.getPages()
  const marked = graph
    .flattenTree(imported.id)
    .map(({ node }) => node)
    .filter((node) => node.name.startsWith(PAGE_PREFIX))
  for (const node of marked) {
    const page = graph.addPage(node.name.slice(PAGE_PREFIX.length))
    graph.reparentNode(node.id, page.id)
    graph.updateNode(node.id, { x: 0, y: 0, name: page.name })
  }
  if (marked.length > 0) graph.deleteNode(imported.id)
}

/** The kit as a `.fig` file, as the gallery publishes it. */
export async function buildKit(kit: KitDefinition): Promise<Uint8Array> {
  return exportFigFile(await buildKitGraph(kit))
}
