import process from 'node:process'

import { test, type Page } from '@playwright/test'
import { pick } from 'es-toolkit'

import type { CSSComputeOptions, DesignDocument, DesignNode } from '@open-pencil/dom-css'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

const BROWSER_RUNTIME_MODULE = `/@fs${process.cwd()}/packages/dom-css/src/runtime/browser.ts`
const DOM_CSS_BROWSER_MODULE = '/@id/@open-pencil/dom-css/browser'

async function ensureAppPage(page: Page) {
  const baseURL = test.info().project.use.baseURL
  if (!baseURL) throw new Error('App tests require a configured baseURL')
  const origin = new URL(baseURL).origin
  if (new URL(page.url()).origin !== origin) {
    await page.goto(origin)
  }
}

/**
 * The token stylesheet for a small theme, written in the page so values and conditions are
 * checked by the browser's own CSS parser: valid ones kept, ones that close their rule left out.
 */
export async function browserTokenStylesheet(page: Page) {
  await ensureAppPage(page)
  return page.evaluate(
    async ({ exportModule, graphModule }) => {
      const { tokenStylesheet } = await import(exportModule)
      const { SceneGraph } = await import(graphModule)
      const graph = new SceneGraph()
      graph.addCollection({
        id: 'theme',
        name: 'Theme',
        modes: [
          { modeId: 'light', name: 'Light' },
          { modeId: 'dark', name: 'Dark' },
          { modeId: 'evil', name: 'Evil', condition: '.x } body { display: none' }
        ],
        defaultModeId: 'light',
        variableIds: []
      })
      const add = (id: string, name: string, type: string, values: object, extra = {}) =>
        graph.addVariable({
          id,
          name,
          type,
          collectionId: 'theme',
          valuesByMode: values,
          description: '',
          hiddenFromPublishing: false,
          ...extra
        })
      add('surface', 'Surface', 'COLOR', {
        light: { r: 1, g: 1, b: 1, a: 1 },
        dark: { r: 0, g: 0, b: 0, a: 1 },
        evil: { r: 1, g: 0, b: 0, a: 1 }
      })
      add(
        'gutter',
        'Gutter',
        'FLOAT',
        { light: 24, dark: 24, evil: 24 },
        {
          scopes: ['GAP'],
          expressions: { light: { css: 'clamp(1rem, 4vw, 2rem)', resolved: 24 } }
        }
      )
      add(
        'gap',
        'Gap',
        'FLOAT',
        { light: 8, dark: 8, evil: 8 },
        {
          expressions: { light: { css: '1px; } body { display: none', resolved: 8 } }
        }
      )
      const { css, issues } = await tokenStylesheet(graph, { format: 'css' })
      return { css, issues: issues.map((issue: { message: string }) => issue.message) }
    },
    {
      exportModule: '/@id/@open-pencil/dom-css/export',
      graphModule: '/@id/@open-pencil/scene-graph'
    }
  )
}

export async function setStyledContent(page: Page, css: string, body: string) {
  await page.setContent(`
    <style>${css}</style>
    ${body}
  `)
}

export async function browserRuntimeComputeStyles(
  page: Page,
  document: DesignDocument,
  cssText: string,
  sandbox: 'shadow-root' | 'iframe' = 'iframe',
  compute: CSSComputeOptions = {}
) {
  await ensureAppPage(page)

  return page.evaluate(
    async ({ designDocument, css, modulePath, sandboxMode, computeOptions }) => {
      const { createBrowserCSSRuntime } = await import(modulePath)
      const runtime = createBrowserCSSRuntime({ document: window.document, sandbox: sandboxMode })
      return runtime.computeStyles(designDocument, css, computeOptions)
    },
    {
      designDocument: document,
      css: cssText,
      modulePath: BROWSER_RUNTIME_MODULE,
      sandboxMode: sandbox,
      computeOptions: compute
    }
  )
}

/** Where a browser import starts: HTML, or a card of Tailwind `classes` around a heading. */
type BrowserImportSource = { html: string } | { classes: readonly string[] }

/**
 * The first layer on the page a public browser import builds from `source`, and the image
 * hashes whose bytes it stored, read in the page through `@open-pencil/dom-css/browser`.
 */
async function importedFirstLayer(page: Page, source: BrowserImportSource, cssText: string) {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ from, css, modulePath }) => {
      const { browserHTMLToSceneGraph, browserJSXToSceneGraph, jsx } = await import(modulePath)
      const graph: SceneGraph =
        'html' in from
          ? await browserHTMLToSceneGraph(from.html, { cssText: css })
          : await browserJSXToSceneGraph(
              jsx('article', {
                class: from.classes.join(' '),
                children: jsx('h1', { children: 'OpenPencil' })
              }),
              { cssText: css }
            )
      const pageNode = graph.getPages()[0]
      const layer = pageNode ? graph.getChildren(pageNode.id)[0] : undefined
      return layer ? { layer, storedImages: [...graph.images.keys()] } : null
    },
    { from: source, css: cssText, modulePath: DOM_CSS_BROWSER_MODULE }
  )
}

/** The card frame's size and layout. */
function cardLayout(layer: SceneNode) {
  return pick(layer, ['height', 'itemSpacing', 'layoutMode', 'paddingLeft', 'type', 'width'])
}

export async function publicBrowserHTMLSceneGraph(page: Page, html: string, cssText = '') {
  const imported = await importedFirstLayer(page, { html }, cssText)
  return imported ? cardLayout(imported.layer) : null
}

export async function publicBrowserSceneGraph(page: Page, classes: string[], cssText: string) {
  const imported = await importedFirstLayer(page, { classes }, cssText)
  return imported ? cardLayout(imported.layer) : null
}

export async function publicBrowserImageNode(page: Page, html: string, cssText: string) {
  const imported = await importedFirstLayer(page, { html }, cssText)
  if (!imported) return null
  const { layer: image, storedImages } = imported
  const fill = image.fills[0]
  return {
    fillType: fill?.type,
    hasImageBytes: fill?.imageHash ? storedImages.includes(fill.imageHash) : false,
    height: image.height,
    imageScaleMode: fill?.imageScaleMode,
    type: image.type,
    width: image.width
  }
}

export async function publicBrowserTextNode(page: Page, html: string, cssText: string) {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ sourceHTML, css, modulePath }) => {
      const { browserHTMLToSceneGraph } = await import(modulePath)
      const graph = await browserHTMLToSceneGraph(sourceHTML, { cssText: css })
      return graph.getAllNodes().find((node: SceneNode) => node.type === 'TEXT')
    },
    { sourceHTML: html, css: cssText, modulePath: DOM_CSS_BROWSER_MODULE }
  )
}

export async function computedStyleProperties(
  page: Page,
  selector: string,
  properties: readonly string[]
) {
  return page.locator(selector).evaluate((element, styleProperties) => {
    const computed = getComputedStyle(element)
    return Object.fromEntries(
      styleProperties.map((property) => [property, computed.getPropertyValue(property)])
    )
  }, properties)
}

const CORE_HTML_LAYERS_MODULE = '/@id/@open-pencil/core/io/formats/html/layers'

/**
 * Imports HTML as the app does: styled and laid out by the browser, then built into layers by
 * Core. Returns each element with an id, its captured box, and the box of the layer named for it.
 */
export interface ImportedLayer {
  id: string
  captured: Rect
  layer: Rect
}

export async function browserImportedLayers(
  page: Page,
  html: string,
  viewport: { width: number; height: number }
): Promise<ImportedLayer[]> {
  await ensureAppPage(page)
  return page.evaluate(
    async ({ source, size, domModule, layersModule }) => {
      const { browserHTMLToDesignDocument } = await import(domModule)
      const { sceneGraphFromStyledHTML } = await import(layersModule)
      const styled: DesignDocument = await browserHTMLToDesignDocument(source, {
        compute: { layout: true, viewport: size }
      })
      const graph: SceneGraph = await sceneGraphFromStyledHTML(styled)
      const captured = new Map<string, Rect>()
      const walk = (nodes: DesignNode[]) => {
        for (const node of nodes) {
          if (node.type !== 'element') continue
          if (node.attrs.id && node.layout) captured.set(node.attrs.id, node.layout.box)
          walk(node.children)
        }
      }
      walk(styled.children)
      const pageId = graph.getPages()[0].id
      return graph.flattenTree(pageId).flatMap(({ node }) => {
        const box = captured.get(node.name)
        if (!box) return []
        const position = graph.getAbsolutePosition(node.id)
        const layer = { x: position.x, y: position.y, width: node.width, height: node.height }
        return [{ id: node.name, captured: box, layer }]
      })
    },
    {
      source: html,
      size: viewport,
      domModule: DOM_CSS_BROWSER_MODULE,
      layersModule: CORE_HTML_LAYERS_MODULE
    }
  )
}
