import type { Page } from '@playwright/test'

import { browserImportedLayers, browserRuntimeComputeStyles } from '#tests/helpers/dom-css/browser'

import { expect, test } from '../fixtures'

const VIEWPORT = { width: 800, height: 600 }
const PROBE = 'https://probe.test/ran'
const PICTURE = 'https://images.test/picture.svg'
const MISSING = 'https://images.test/missing.png'

/** A script that reports it ran by requesting the probe, which the test counts. */
function report(name: string): string {
  return `fetch('${PROBE}?${name}', { mode: 'no-cors' })`
}

/**
 * Every way markup starts a script without a click: handlers on loading and failing images, on
 * SVG, on an element that toggles or animates as it renders, and documents nested in frames.
 */
const HOSTILE_HTML = `
  <style>@keyframes pulse { to { opacity: 0.5 } }</style>
  <div id="box" style="width: 120px; height: 40px"></div>
  <img id="picture" src="${PICTURE}" onload="${report('image-load')}">
  <img src="${MISSING}" onerror="${report('image-error')}">
  <svg onload="${report('svg-load')}"></svg>
  <details open ontoggle="${report('details-toggle')}"><summary>More</summary></details>
  <div style="animation: pulse 1ms" onanimationstart="${report('animation-start')}"></div>
  <iframe srcdoc="&lt;script&gt;${report('nested-document')}&lt;/script&gt;"></iframe>
  <iframe src="javascript:${report('javascript-url')}"></iframe>
  <script>${report('script-element')}</script>
`

/** Serves the images the markup names and records each script that reports running. */
async function watchScripts(page: Page): Promise<{ ran: string[]; images: string[] }> {
  const ran: string[] = []
  const images: string[] = []
  await page.route(`${PROBE}*`, async (route) => {
    ran.push(new URL(route.request().url()).search.slice(1))
    await route.fulfill({ status: 204 })
  })
  await page.route('https://images.test/**', async (route) => {
    const url = route.request().url()
    images.push(url)
    if (url !== PICTURE) return route.fulfill({ status: 404 })
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="30"></svg>'
    })
  })
  return { ran, images }
}

test.describe('@open-pencil/dom-css browser runtime with untrusted markup', () => {
  test('lays imported HTML out without running its scripts', async ({ page }) => {
    const { ran, images } = await watchScripts(page)

    const layers = await browserImportedLayers(page, HOSTILE_HTML, VIEWPORT)

    // The markup was rendered: its images were fetched and its boxes measured.
    expect(images).toContain(PICTURE)
    expect(images).toContain(MISSING)
    expect(layers.find((layer) => layer.id === 'box')?.captured).toMatchObject({
      width: 120,
      height: 40
    })
    expect(layers.find((layer) => layer.id === 'picture')?.captured).toMatchObject({
      width: 50,
      height: 30
    })
    expect(ran).toEqual([])
  })

  test('computes styles without running the handlers a document carries', async ({ page }) => {
    const { ran, images } = await watchScripts(page)

    const styled = await browserRuntimeComputeStyles(
      page,
      {
        type: 'document',
        children: [
          {
            type: 'element',
            tagName: 'img',
            attrs: { src: MISSING, onerror: report('image-error') },
            children: []
          },
          {
            type: 'element',
            tagName: 'p',
            attrs: { class: 'note' },
            children: [{ type: 'text', text: 'OpenPencil' }]
          }
        ]
      },
      '.note { width: 96px }'
    )

    const note = styled.children[1]
    expect(note?.type === 'element' ? note.computedStyle?.width : undefined).toBe('96px')
    expect(images).toContain(MISSING)
    expect(ran).toEqual([])
  })
})
