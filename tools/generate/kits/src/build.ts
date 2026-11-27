import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

import { MODE_PREFIX, PAGE_PREFIX, type KitAbout, type KitDefinition, type KitSources } from './kit'
import type { RenderReply, RenderRequest } from './react/worker'
import { kitTheme } from './theme'

export type { KitDefinition } from './kit'

/**
 * Renders the kit's page from its own components as a browser shows it once mounted, in a worker
 * whose realm holds the browser's globals and ends with the render.
 */
export async function renderKitPage(
  kit: KitDefinition,
  sources: KitSources,
  about: KitAbout
): Promise<string> {
  const worker = new Worker(new URL('react/worker.ts', import.meta.url))
  try {
    const reply = await new Promise<RenderReply>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<RenderReply>) => resolve(event.data)
      worker.onerror = (event) => reject(new Error(event.message))
      // A worker takes no target origin; an empty transfer list is its second argument.
      const request: RenderRequest = { page: kit.page, sources, about, instances: kit.instances }
      worker.postMessage(request, { transfer: [] })
    })
    if ('error' in reply) throw new Error(`Could not render ${kit.name}: ${reply.error}`)
    return reply.html
  } finally {
    worker.terminate()
  }
}

/**
 * The kit's stylesheet compiled for the classes it uses, as Tailwind builds it for a site: the
 * candidates in the files its sources name (its own folder unless it says otherwise, with any
 * `@source`) and in the page module, and those the rendered page holds. Markup escapes quotes,
 * so a class such as `[&_svg:not([class*='size-'])]:size-4` is read from the source it is in.
 */
export async function compileKitStylesheet(
  kit: KitDefinition,
  sources: KitSources,
  html: string
): Promise<string> {
  const stylesheet = await Bun.file(sources.stylesheet).text()
  const base = dirname(sources.stylesheet)
  const compiler = await compile(`${stylesheet}\n${kit.css ?? ''}`, {
    base,
    // The kit is built once, so nothing watches the files the stylesheet reads.
    onDependency: () => undefined,
    shouldRewriteUrls: true
  })
  const root = compiler.root === 'none' ? [] : [compiler.root ?? { base, pattern: '**/*' }]
  const scanner = new Scanner({
    sources: [...root, ...compiler.sources, { base: dirname(kit.page), pattern: '**/*' }].map(
      (source) => ({ negated: false, ...source })
    )
  })
  const candidates = new Set([
    ...scanner.scan(),
    ...scanner.scanFiles([{ content: html, extension: 'html' }])
  ])
  return compiler.build([...candidates])
}

/**
 * Draws the kit: its page rendered from its installed sources, styled in each of its modes, and
 * imported with components. The page is named after what installed them.
 */
export async function buildKitGraph(kit: KitDefinition): Promise<SceneGraph> {
  const sources = await kit.sources()
  const theme = kitTheme(await Bun.file(sources.stylesheet).text())
  const about: KitAbout = { installer: sources.installer, docs: sources.docs, theme }
  const html = await renderKitPage(kit, sources, about)
  const cssText = await compileKitStylesheet(kit, sources, html)
  const { graph } = await readHTMLDocument(html, {
    cssText,
    // The stylesheet's URLs, such as its fonts', are relative to it.
    baseURL: pathToFileURL(`${dirname(sources.stylesheet)}/`).href,
    components: true,
    variables: { collection: kit.name, modes: kit.modes }
  })
  showModes(graph, kit.name)
  splitPages(graph)
  return graph
}

/**
 * Makes each layer the page marked as shown in a mode of the kit's variables show it, and names
 * it after the mode. Its layers are bound to the variables, so they draw as the mode does.
 */
function showModes(graph: SceneGraph, collectionName: string): void {
  const collection = [...graph.variableCollections.values()].find(
    ({ name }) => name === collectionName
  )
  if (!collection) return
  const shown: string[] = []
  for (const node of graph.getAllNodes()) {
    if (!node.name.startsWith(MODE_PREFIX)) continue
    const name = node.name.slice(MODE_PREFIX.length)
    const mode = collection.modes.find((each) => each.name === name)
    if (!mode) throw new Error(`The kit has no mode ${name}`)
    graph.updateNode(node.id, {
      name,
      variableModes: { ...node.variableModes, [collection.id]: mode.modeId }
    })
    shown.push(node.id)
  }
  // The layers keep the values they were imported with until their bindings resolve again.
  reconcileVariableBindings(graph, { subtrees: shown })
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
