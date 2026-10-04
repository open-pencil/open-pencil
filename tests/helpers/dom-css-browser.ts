import process from 'node:process'

import { test, type Page } from '@playwright/test'

import type { DesignDocument } from '@open-pencil/dom-css'

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
  sandbox: 'shadow-root' | 'iframe' = 'iframe'
) {
  await ensureAppPage(page)

  return page.evaluate(
    async ({ designDocument, css, modulePath, sandboxMode }) => {
      const { createBrowserCSSRuntime } = await import(modulePath)
      const runtime = createBrowserCSSRuntime({ document: window.document, sandbox: sandboxMode })
      return runtime.computeStyles(designDocument, css)
    },
    {
      designDocument: document,
      css: cssText,
      modulePath: BROWSER_RUNTIME_MODULE,
      sandboxMode: sandbox
    }
  )
}

export async function publicBrowserHTMLSceneGraph(page: Page, html: string, cssText = '') {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ sourceHTML, css, modulePath }) => {
      const { browserHTMLToSceneGraph } = await import(modulePath)
      const graph = await browserHTMLToSceneGraph(sourceHTML, { cssText: css })
      const pageNode = graph.getPages()[0]
      const card = pageNode ? graph.getChildren(pageNode.id)[0] : undefined
      return card
        ? {
            height: card.height,
            itemSpacing: card.itemSpacing,
            layoutMode: card.layoutMode,
            paddingLeft: card.paddingLeft,
            type: card.type,
            width: card.width
          }
        : null
    },
    { sourceHTML: html, css: cssText, modulePath: DOM_CSS_BROWSER_MODULE }
  )
}

export async function publicBrowserSceneGraph(page: Page, classes: string[], cssText: string) {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ candidates, css, modulePath }) => {
      const { browserJSXToSceneGraph, jsx } = await import(modulePath)
      const graph = await browserJSXToSceneGraph(
        jsx('article', {
          class: candidates.join(' '),
          children: jsx('h1', { children: 'OpenPencil' })
        }),
        { cssText: css }
      )
      const pageNode = graph.getPages()[0]
      const card = pageNode ? graph.getChildren(pageNode.id)[0] : undefined
      return card
        ? {
            height: card.height,
            itemSpacing: card.itemSpacing,
            layoutMode: card.layoutMode,
            paddingLeft: card.paddingLeft,
            type: card.type,
            width: card.width
          }
        : null
    },
    { candidates: classes, css: cssText, modulePath: DOM_CSS_BROWSER_MODULE }
  )
}

export async function publicBrowserImageNode(page: Page, html: string, cssText: string) {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ sourceHTML, css, modulePath }) => {
      const { browserHTMLToSceneGraph } = await import(modulePath)
      const graph = await browserHTMLToSceneGraph(sourceHTML, { cssText: css })
      const pageNode = graph.getPages()[0]
      const image = pageNode ? graph.getChildren(pageNode.id)[0] : undefined
      const fill = image?.fills[0]
      return image
        ? {
            fillType: fill?.type,
            hasImageBytes: fill?.imageHash ? graph.images.has(fill.imageHash) : false,
            height: image.height,
            imageScaleMode: fill?.imageScaleMode,
            type: image.type,
            width: image.width
          }
        : null
    },
    { sourceHTML: html, css: cssText, modulePath: DOM_CSS_BROWSER_MODULE }
  )
}

export async function publicBrowserTextNode(page: Page, html: string, cssText: string) {
  await ensureAppPage(page)
  await page.setContent('<main></main>')

  return page.evaluate(
    async ({ sourceHTML, css, modulePath }) => {
      const { browserHTMLToSceneGraph } = await import(modulePath)
      const graph = await browserHTMLToSceneGraph(sourceHTML, { cssText: css })
      return graph.getAllNodes().find((node) => node.type === 'TEXT')
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
