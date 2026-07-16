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

/**
 * Search for a font family in the font picker's search input.
 * The font picker uses a virtualizer, so only visible items are rendered.
 * Searching filters the list so the target font becomes visible.
 */
async function searchFontInPicker(page: Page, query: string) {
  await page.getByPlaceholder('Search fonts…').fill(query)
}

async function installGoogleFontsMock(page: Page, families = ['Inter', 'OpenPencil Google Font']) {
  await page.addInitScript((googleFamilies) => {
    const win = window as Window & {
      __googleFontsFetchCount?: number
      __googleFontPreviewFetchCount?: number
      __OPENPENCIL_TEST_WEB_FONT_FETCH?: boolean
    }
    win.__googleFontsFetchCount = 0
    win.__googleFontPreviewFetchCount = 0
    // Tell the font system to use window.fetch for web fonts (test mode)
    win.__OPENPENCIL_TEST_WEB_FONT_FETCH = true
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      let url: string
      if (typeof input === 'string') url = input
      else if (input instanceof URL) url = input.href
      else url = input.url

      // Font file downloads (mock font binary)
      if (url.startsWith('https://fonts.openpencil.test/')) {
        win.__googleFontPreviewFetchCount = (win.__googleFontPreviewFetchCount ?? 0) + 1
        return new Response(new ArrayBuffer(8), { status: 200 })
      }

      // Google Fonts metadata API (used by unifont's google provider)
      if (url.startsWith('https://fonts.google.com/metadata/fonts')) {
        win.__googleFontsFetchCount = (win.__googleFontsFetchCount ?? 0) + 1
        return new Response(
          JSON.stringify({
            familyMetadataList: googleFamilies.map((family) => ({
              family,
              axes: [],
              fonts: {
                '400': {
                  regular: `https://fonts.openpencil.test/${encodeURIComponent(family)}.ttf`
                }
              }
            }))
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      // Google Fonts CSS2 API (used by unifont to resolve font files)
      if (url.startsWith('https://fonts.googleapis.com/css2')) {
        const familyMatch = url.match(/family=([^:&]+)/)
        const family = familyMatch ? decodeURIComponent(familyMatch[1].replace(/\+/g, ' ')) : ''
        const css = `@font-face{font-family:'${family}';font-style:normal;font-weight:400;src:url(https://fonts.openpencil.test/${encodeURIComponent(family)}.ttf) format('truetype');}`
        return new Response(css, { status: 200, headers: { 'content-type': 'text/css' } })
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
          family: 'OpenPencil Local Font',
          fullName: 'OpenPencil Local Font Regular',
          postscriptName: 'OpenPencilLocalFont-Regular',
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
  await searchFontInPicker(page, 'OpenPencil Local')

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
})

test('font picker lists Google fonts when local font API is unavailable', async ({ page }) => {
  await installGoogleFontsMock(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFontInPicker(page, 'OpenPencil Google')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
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
  await searchFontInPicker(page, 'OpenPencil Google')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
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
  await searchFontInPicker(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'Inter' }).first()
  ).toBeVisible()
})
