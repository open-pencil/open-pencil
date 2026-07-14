import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openTypographyForText(page: Page) {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 120, 120, 240, 40)
    store.updateNode(id, { characters: 'Font picker smoke' })
    store.select([id])
    return id
  })
}

async function openFontPicker(page: Page) {
  await page.getByTestId('font-picker-trigger').click()
}

async function installWebFontFetchSentinel(page: Page) {
  await page.addInitScript(() => {
    const win = window as Window & {
      __webFontCatalogFetchCount?: number
      __webFontPreviewFetchCount?: number
    }
    win.__webFontCatalogFetchCount = 0
    win.__webFontPreviewFetchCount = 0
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      let url: string
      if (typeof input === 'string') url = input
      else if (input instanceof URL) url = input.href
      else url = input.url
      if (
        url.startsWith('https://fonts.google.com/metadata/fonts') ||
        url.startsWith('https://www.googleapis.com/webfonts/v1/webfonts') ||
        url.startsWith('https://api.fontsource.org/') ||
        url.startsWith('https://fonts.bunny.net/') ||
        url.startsWith('https://api.fontshare.com/')
      ) {
        win.__webFontCatalogFetchCount = (win.__webFontCatalogFetchCount ?? 0) + 1
        return new Response(JSON.stringify({ items: [], fonts: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      if (
        url.startsWith('https://fonts.openpencil.test/') ||
        url.startsWith('https://fonts.gstatic.com/')
      ) {
        win.__webFontPreviewFetchCount = (win.__webFontPreviewFetchCount ?? 0) + 1
        return new Response(new ArrayBuffer(8), { status: 200 })
      }
      return originalFetch(input, init)
    }
  })
}

async function expectNoWebFontFetch(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as Window & {
          __webFontCatalogFetchCount?: number
          __webFontPreviewFetchCount?: number
        }
        return {
          catalog: win.__webFontCatalogFetchCount ?? 0,
          preview: win.__webFontPreviewFetchCount ?? 0
        }
      })
    )
    .toEqual({ catalog: 0, preview: 0 })
}

test('font picker selects local fonts without fetching unavailable browser web catalogs', async ({
  page
}) => {
  await installWebFontFetchSentinel(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => [
        {
          family: 'Inter',
          fullName: 'Inter Regular',
          postscriptName: 'Inter-Regular',
          style: 'Regular'
        },
        {
          family: 'OpenPencil Local Font',
          fullName: 'OpenPencil Local Font Regular',
          postscriptName: 'OpenPencilLocalFont-Regular',
          style: 'Regular'
        }
      ]
    })
  })

  const textId = await openTypographyForText(page)
  await openFontPicker(page)

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Local Font' })
  ).toBeVisible()
  await page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Local Font' }).click()

  await expect(page.getByTestId('font-picker-trigger')).toContainText('OpenPencil Local Font')
  await expect
    .poll(async () =>
      page.evaluate((id) => {
        const store = window.openPencil?.getStore?.()
        const node = store?.graph.getNode(id)
        return node?.type === 'TEXT' ? node.fontFamily : null
      }, textId)
    )
    .toBe('OpenPencil Local Font')
  await expectNoWebFontFetch(page)
})

test('font picker keeps bundled fonts when local font API is unavailable', async ({ page }) => {
  await installWebFontFetchSentinel(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)

  await expect(page.getByTestId('font-picker-item').filter({ hasText: 'Inter' })).toBeVisible()
  await expect(page.getByText('Local fonts are not available in this browser.')).toHaveCount(0)
  await expectNoWebFontFetch(page)
})

test('font picker keeps bundled fonts when local font permission is rejected', async ({ page }) => {
  await installWebFontFetchSentinel(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => {
        throw new Error('denied')
      }
    })
  })

  await openTypographyForText(page)
  await openFontPicker(page)

  await expect(page.getByTestId('font-picker-item').filter({ hasText: 'Inter' })).toBeVisible()
  await expect(page.getByText('Local font access is blocked for this site.')).toHaveCount(0)
  await expectNoWebFontFetch(page)
})

test('font picker keeps bundled Inter available when local and web fonts are unavailable', async ({
  page
}) => {
  await installWebFontFetchSentinel(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)

  await expect(page.getByTestId('font-picker-item').filter({ hasText: 'Inter' })).toBeVisible()
  await expectNoWebFontFetch(page)
})
