import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { mockGoogleFonts } from '#tests/helpers/fonts/google'

async function openTypographyForText(page: Page) {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 120, 120, 240, 40)
    store.updateNode(id, { text: 'Font picker smoke' })
    store.select([id])
    return id
  })
}

async function openFontPicker(page: Page) {
  await page.getByTestId('font-picker-trigger').click()
}

async function searchFonts(page: Page, query: string) {
  await page.getByRole('combobox', { name: 'Search fonts…' }).fill(query)
}

test('font picker selects local fonts without browser web-font access', async ({ page }) => {
  const fonts = await mockGoogleFonts(page)
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
  await searchFonts(page, 'OpenPencil Local Font')

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
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled fonts when local and web fonts are unavailable', async ({
  page
}) => {
  const fonts = await mockGoogleFonts(page)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
  ).toHaveCount(0)
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled fonts when local font permission is rejected', async ({ page }) => {
  const fonts = await mockGoogleFonts(page)
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
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: 'OpenPencil Google Font' })
  ).toHaveCount(0)
  expect(fonts.counts.metadata).toBe(0)
})

test('font picker keeps bundled Inter available when local and Google fonts are unavailable', async ({
  page
}) => {
  await mockGoogleFonts(page, [])
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'queryLocalFonts')
  })

  await openTypographyForText(page)
  await openFontPicker(page)
  await searchFonts(page, 'Inter')

  await expect(
    page.getByTestId('font-picker-item').filter({ hasText: /^Interbundled$/ })
  ).toBeVisible()
})
