import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { CanvasHelper } from '#tests/helpers/canvas'

const SITE = 'https://site.example.test'
/** Lets the app's own origin read the fake site, as a site that allows other sites does. */
const OPEN = { 'access-control-allow-origin': '*' }

async function openFromURL(page: Page, address: string) {
  await page.getByTestId('menubar-file').click()
  await page.getByRole('menuitem', { name: 'Open from URL…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Open from URL' })
  await dialog.getByLabel('Address').fill(address)
  await dialog.getByRole('button', { name: 'Open', exact: true }).click()
  return dialog
}

test('a web page opens as layers with the stylesheet and picture it links', async ({ page }) => {
  const png = await readFile(join(FIXTURES, 'absolute-constraint-figma.png'))
  await page.route(`${SITE}/**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/') {
      return route.fulfill({
        headers: { ...OPEN, 'content-type': 'text/html' },
        body: '<link rel="stylesheet" href="/site.css"><div class="box"></div><img src="img/photo.png">'
      })
    }
    if (pathname === '/site.css') {
      return route.fulfill({
        headers: { ...OPEN, 'content-type': 'text/css' },
        body: '.box { width: 120px; height: 40px; background: #2563eb }'
      })
    }
    if (pathname === '/img/photo.png') {
      return route.fulfill({ headers: { ...OPEN, 'content-type': 'image/png' }, body: png })
    }
    return route.fulfill({ status: 404, headers: OPEN })
  })
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const tabs = page.getByRole('tablist').filter({ has: page.getByTestId('tabbar-tab') })

  const dialog = await openFromURL(page, 'site.example.test')

  await expect(dialog).toHaveCount(0)
  await expect(tabs.getByRole('tab').last()).toContainText('site.example.test')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) return null
        const layers = store.graph.getChildren(store.state.currentPageId)
        return layers.map((layer) => ({
          width: layer.width,
          image: layer.fills.some((fill) => fill.type === 'IMAGE')
        }))
      })
    )
    .toEqual([{ width: 120, image: false }, expect.objectContaining({ image: true })])
})

test('an address that holds a PDF says it cannot be opened yet', async ({ page }) => {
  await page.route(`${SITE}/**`, (route) =>
    route.fulfill({ headers: { ...OPEN, 'content-type': 'application/pdf' }, body: '%PDF-1.7\n' })
  )
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  const dialog = await openFromURL(page, `${SITE}/report.pdf`)

  await expect(dialog).toContainText('This address holds a PDF, which OpenPencil cannot open yet.')
})

test('a site that does not let other sites read it points to the desktop app', async ({ page }) => {
  // A real server on another origin, as the browser checks cross-origin reads of real responses.
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' }).end('<p>Hi</p>')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('The test server has no port')
  const { port } = address
  try {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()

    const dialog = await openFromURL(page, `http://127.0.0.1:${port}/`)

    await expect(dialog).toContainText('The desktop app can.')
  } finally {
    server.close()
  }
})

test('the dialog asks for a web address', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  const dialog = await openFromURL(page, 'mailto:someone@example.com')

  await expect(dialog).toContainText('Enter a web address, such as https://example.com.')
})
