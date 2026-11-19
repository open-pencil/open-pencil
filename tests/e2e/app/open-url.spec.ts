import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getPageChildren, getPageColor, getPageTexts } from '#tests/helpers/store'

const SITE = 'https://site.example.test'
/** Lets the app's own origin read the fake site, as a site that allows other sites does. */
const OPEN = { 'access-control-allow-origin': '*' }

async function openFromURL(page: Page, address: string) {
  await page.getByTestId('menubar-file').click()
  await page.getByRole('menuitem', { name: 'Open from URL…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Open from URL' })
  await dialog.getByRole('textbox', { name: 'Address' }).fill(address)
  await dialog.getByRole('button', { name: 'Open', exact: true }).click()
  return dialog
}

/** The dialog stays open with an alert saying why, and no document was opened. */
async function expectRefused(page: Page, dialog: Locator) {
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Address' })).toBeEditable()
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(1)
}

test('a web page opens as layers with the stylesheet and pictures it links', async ({ page }) => {
  const png = await readFile(join(FIXTURES, 'absolute-constraint-figma.png'))
  const font = await readFile(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf'))
  await page.route(`${SITE}/**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/') {
      return route.fulfill({
        headers: { ...OPEN, 'content-type': 'text/html' },
        body: '<link rel="stylesheet" href="/site.css"><div class="box"></div><img src="img/photo.png"><img src="img/logo.svg" style="display:block;width:40px;height:20px"><p>Set in the site font</p>'
      })
    }
    if (pathname === '/site.css') {
      return route.fulfill({
        headers: { ...OPEN, 'content-type': 'text/css' },
        body: "@font-face { font-family: 'Site Sans'; src: url(fonts/site.ttf) format('truetype') } .box { width: 120px; height: 40px; background: #2563eb } p { font-family: 'Site Sans', sans-serif; margin: 0 } body { background: #f0f4f8 }"
      })
    }
    if (pathname === '/img/photo.png') {
      return route.fulfill({ headers: { ...OPEN, 'content-type': 'image/png' }, body: png })
    }
    if (pathname === '/fonts/site.ttf') {
      return route.fulfill({ headers: { ...OPEN, 'content-type': 'font/ttf' }, body: font })
    }
    if (pathname === '/img/logo.svg') {
      return route.fulfill({
        headers: { ...OPEN, 'content-type': 'image/svg+xml' },
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#0969da"/></svg>'
      })
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
    .poll(async () =>
      (await getPageChildren(page)).map(({ width, fillTypes, childIds }) => ({
        width,
        image: fillTypes.includes('IMAGE'),
        artwork: childIds.length > 0
      }))
    )
    .toEqual([
      { width: 120, image: false, artwork: false },
      expect.objectContaining({ image: true }),
      // The SVG picture becomes the vector layers it draws, at the size the page shows it.
      { width: 40, image: false, artwork: true },
      expect.objectContaining({ artwork: true })
    ])
  // The page behind the layers is the site's own background.
  expect(await getPageColor(page)).toMatchObject({ r: 0xf0 / 255, g: 0xf4 / 255, b: 0xf8 / 255 })
  // Text in the page's own web font is set in it, loaded from the site.
  expect(await getPageTexts(page)).toContainEqual({
    text: 'Set in the site font',
    fontFamily: 'Site Sans'
  })
})

test('an address that holds a PDF says it cannot be opened yet', async ({ page }) => {
  await page.route(`${SITE}/**`, (route) =>
    route.fulfill({ headers: { ...OPEN, 'content-type': 'application/pdf' }, body: '%PDF-1.7\n' })
  )
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  const dialog = await openFromURL(page, `${SITE}/report.pdf`)

  await expectRefused(page, dialog)
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

    await expectRefused(page, dialog)
  } finally {
    server.close()
  }
})

test('the dialog asks for a web address', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()

  const dialog = await openFromURL(page, 'mailto:someone@example.com')

  // The field is marked for correction, and nothing was fetched or opened.
  await expect(dialog.getByRole('textbox', { name: 'Address' })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(page.getByTestId('tabbar-tab')).toHaveCount(1)
})
