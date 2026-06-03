import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function openTypographyForText(page: Page) {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  return page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    const id = store.createShape('TEXT', 120, 120, 240, 40)
    store.updateNode(id, { characters: 'Font picker smoke' })
    store.select([id])
    return id
  })
}

async function openFontPicker(page: Page) {
  await page.getByTestId('font-picker-trigger').click()
}

async function installGoogleFontsMock(page: Page, families = ['Inter', 'Inkly Google Font']) {
  await page.addInitScript((googleFamilies) => {
    const win = window as Window & {
      __googleFontsFetchCount?: number
      __googleFontPreviewFetchCount?: number
    }
    win.__googleFontsFetchCount = 0
    win.__googleFontPreviewFetchCount = 0
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      let url: string
      if (typeof input === 'string') url = input
      else if (input instanceof URL) url = input.href
      else url = input.url
      if (url.startsWith('https://fonts.inkly.test/')) {
        win.__googleFontPreviewFetchCount = (win.__googleFontPreviewFetchCount ?? 0) + 1
        return new Response(new ArrayBuffer(8), { status: 200 })
      }
      if (url.startsWith('https://www.googleapis.com/webfonts/v1/webfonts')) {
        if (!url.includes('family='))
          win.__googleFontsFetchCount = (win.__googleFontsFetchCount ?? 0) + 1
        return new Response(
          JSON.stringify({
            items: googleFamilies.map((family) => ({
              family,
              files: { regular: `https://fonts.inkly.test/${encodeURIComponent(family)}.ttf` }
            }))
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      return originalFetch(input, init)
    }
  }, families)
}

test('font picker preloads Google fonts and selects local fonts after first-open access', async ({
  page
}) => {
  await installGoogleFontsMock(page)
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
          family: 'Inkly Local Font',
          fullName: 'Inkly Local Font Regular',
          postscriptName: 'InklyLocalFont-Regular',
          style: 'Regular'
        }
      ]
    })
  })

  const textId = await openTypographyForText(page)
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __googleFontsFetchCount?: number }).__googleFontsFetchCount
      )
    )
    .toBe(1)
  await openFontPicker(page)

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'Inkly Local Font' })
  ).toBeVisible()
  await page.getByTestId('font-picker-item').filter({ hasText: 'Inkly Local Font' }).click()

  await expect(page.getByTestId('font-picker-trigger')).toContainText('Inkly Local Font')
  await expect
    .poll(async () =>
      page.evaluate((id) => {
        const store = window.inkly?.getStore?.()
        const node = store?.graph.getNode(id)
        return node?.type === 'TEXT' ? node.fontFamily : null
      }, textId)
    )
    .toBe('Inkly Local Font')
})

test('font picker lists Google fonts when local font API is unavailable', async ({ page }) => {
  await installGoogleFontsMock(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'Inkly Google Font' })
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __googleFontPreviewFetchCount?: number })
            .__googleFontPreviewFetchCount
      )
    )
    .toBeGreaterThan(0)
  await expect(page.getByText('Local fonts are not available in this browser.')).toHaveCount(0)
})

test('font picker still lists Google fonts when local font permission is rejected', async ({
  page
}) => {
  await installGoogleFontsMock(page)
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

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'Inkly Google Font' })
  ).toBeVisible()
  await expect(page.getByText('Local font access is blocked for this site.')).toHaveCount(0)
})

test('font picker keeps bundled Inter available when local and Google fonts are unavailable', async ({
  page
}) => {
  await installGoogleFontsMock(page, [])
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)

  await expect(page.getByTestId('font-picker-item').filter({ hasText: 'Inter' })).toBeVisible()
})
