import process from 'node:process'

import type { Page } from '@playwright/test'

import type { DesignDocument } from '@open-pencil/dom-css'

const BROWSER_RUNTIME_MODULE = `http://localhost:1420/@fs${process.cwd()}/packages/dom-css/src/runtime/browser.ts`
const DOM_CSS_BROWSER_MODULE = 'http://localhost:1420/@id/@open-pencil/dom-css/browser'

async function ensureAppPage(page: Page) {
  if (!page.url().startsWith('http://localhost:1420')) {
    await page.goto('/')
  }
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
