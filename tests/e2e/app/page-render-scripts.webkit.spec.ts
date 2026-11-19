import { expect, test, type Page } from '@playwright/test'
import * as v from 'valibot'

import type * as RenderPage from '@/app/document/io/url/render/page'

import { CanvasHelper } from '#tests/helpers/canvas'

const SITE = 'https://spa.example.test'

/** The scripts' source text as the desktop app sends it, compiled as the app compiles it. */
async function pageScripts(page: Page) {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  return page.evaluate(async () => {
    const pageURL = '/src/app/document/io/url/render/page.ts'
    const render: typeof RenderPage = await import(pageURL)
    return render.RENDER_SCRIPTS
  })
}

/** A page whose script builds it after it loads, styled with rules the script inserts. */
const APP_PAGE = `<!doctype html><html><head><title>Board</title></head><body>
<div id="root"></div>
<noscript><p>Enable JavaScript</p></noscript>
<script>
  // Built when the test asks, after it has read the page once, as a page builds after it loads.
  document.addEventListener('build', () => {
    const sheet = document.head.appendChild(document.createElement('style')).sheet
    sheet.insertRule('.card { width: 120px }')
    const adopted = new CSSStyleSheet()
    adopted.replaceSync('.title { font-weight: 700 }')
    document.adoptedStyleSheets = [adopted]
    document.getElementById('root').innerHTML =
      '<div class="card"><h1 class="title">Built by script</h1><input id="name"><input id="done" type="checkbox"><textarea id="note"></textarea></div>'
    document.getElementById('name').value = 'Ada'
    document.getElementById('done').checked = true
    document.getElementById('note').value = 'Draft'
  })
</script></body></html>`

const settlingSchema = v.object({ ready: v.boolean(), changes: v.number(), document: v.number() })
const snapshotSchema = v.object({ html: v.string(), url: v.string() })

test('a rendered page reads back as the HTML its scripts built', async ({ page }) => {
  const scripts = await pageScripts(page)
  await page.route(`${SITE}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: APP_PAGE })
  )
  await page.goto(`${SITE}/board`)
  const settling = async () => v.parse(settlingSchema, await page.evaluate(scripts.settle))

  // Counting starts with the first question; the script then builds the page, which it counts.
  const before = await settling()
  await page.evaluate(() => document.dispatchEvent(new Event('build')))
  await expect(page.locator('h1.title')).toBeVisible()
  const after = await settling()
  expect(after.ready).toBe(true)
  expect(after.changes).toBeGreaterThan(before.changes)
  expect(after.document).toBe(before.document)

  const { html, url } = v.parse(snapshotSchema, await page.evaluate(scripts.snapshot))
  const matches = (selector: string) =>
    page.evaluate(
      ([markup, query]) =>
        new DOMParser().parseFromString(markup, 'text/html').querySelector(query) !== null,
      [html, selector] as const
    )

  expect(url).toBe(`${SITE}/board`)
  expect(await matches('h1.title')).toBe(true)
  // Rules inserted through CSSOM and adopted sheets come back as text.
  expect(html).toContain('.card { width: 120px; }')
  expect(html).toContain('.title { font-weight: 700; }')
  // What the fields hold is in their markup; scripts and <noscript> are gone.
  expect(await matches('#name[value="Ada"]')).toBe(true)
  expect(await matches('#done[checked]')).toBe(true)
  expect(html).toContain('>Draft</textarea>')
  expect(await matches('script, noscript')).toBe(false)
  expect(await matches(`base[href="${SITE}/board"]`)).toBe(true)
})
