import type { Page } from '@playwright/test'
import { toUint8Array } from 'js-base64'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { getSelectedNode } from '#tests/helpers/store'

/** A one-pixel PNG served for every photo, so the workflow needs no network. */
const PNG = Buffer.from(
  toUint8Array(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  )
)

const ctx = useEditorSetupWithClear()
/**
 * The searches each service answered, `(picks)` for the photos it lists before a search, and the
 * photos Unsplash was told were used.
 */
const requests = { unsplash: [] as string[], pexels: [] as string[], reported: [] as string[] }

function unsplashPhoto(id: string) {
  const url = `https://images.unsplash.test/${id}.png`
  return {
    id,
    width: 1200,
    height: 800,
    urls: { raw: url, full: url, regular: url, small: url, thumb: url },
    user: { name: 'Ann Lee', links: { html: 'https://unsplash.com/@ann' } },
    links: {
      html: `https://unsplash.com/photos/${id}`,
      download_location: `https://api.unsplash.com/photos/${id}/download`
    }
  }
}

test.beforeAll(async () => {
  await ctx.page.route('https://api.unsplash.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/search/photos') {
      requests.unsplash.push(url.searchParams.get('query') ?? '')
      await route.fulfill({ json: { results: [unsplashPhoto('first'), unsplashPhoto('second')] } })
    } else if (url.pathname === '/photos') {
      requests.unsplash.push('(picks)')
      await route.fulfill({ json: [unsplashPhoto('editorial')] })
    } else {
      requests.reported.push(url.pathname)
      await route.fulfill({ json: { url: 'https://images.unsplash.test/first.png' } })
    }
  })
  await ctx.page.route('https://api.pexels.com/**', async (route) => {
    const url = new URL(route.request().url())
    requests.pexels.push(url.searchParams.get('query') ?? '(picks)')
    const src = 'https://images.pexels.test/one.png'
    await route.fulfill({
      json: {
        photos: [
          {
            id: 7,
            width: 900,
            height: 600,
            url: 'https://www.pexels.com/photo/7/',
            photographer: 'Jonas Berg',
            photographer_url: 'https://www.pexels.com/@jonas',
            src: { original: src, large2x: src, large: src, medium: src, small: src }
          }
        ]
      }
    })
  })
  await ctx.page.route(/https:\/\/images\.(unsplash|pexels)\.test\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PNG })
  )
})

test.beforeEach(() => {
  requests.unsplash = []
  requests.pexels = []
  requests.reported = []
})

/** Draws a rectangle, opens its fill as an image, and opens Stock photo. */
async function openPicker(page: Page) {
  await ctx.canvas.drawRect(120, 120, 160, 120)
  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('fill-picker-tab-image').click()
  await page.getByTestId('fill-picker-stock-photo').click()
  const dialog = page.getByRole('dialog', { name: 'Stock photo' })
  await expect(dialog).toBeVisible()
  return dialog
}

/**
 * Follows the picker's Open Settings to Settings › Image services, saves `service`'s key there, and comes
 * back to the picker.
 */
async function addKeyInSettings(page: Page, service: 'Unsplash' | 'Pexels', label: string) {
  const picker = page.getByRole('dialog', { name: 'Stock photo' })
  await expect(page.getByTestId('photo-picker-key-needed')).toContainText(`Connect ${service}`)
  await picker.getByRole('button', { name: 'Open Settings' }).click()
  await expect(picker).toBeHidden()
  const media = page.getByTestId('settings-media-panel')
  await media.getByRole('button', { name: new RegExp(service) }).click()
  await page.getByLabel(label).fill(`${service.toLowerCase()}-key`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('fill-picker-stock-photo').click()
  await expect(picker).toBeVisible()
  return picker
}

/** The selected layer's image fill, or none. */
async function imageFill(page: Page) {
  const node = await getSelectedNode(page)
  return node?.fills.find((fill) => fill.type === 'IMAGE')
}

test('Stock photo sends a missing key to Settings, then fills the layer with the photo picked', async () => {
  const page = ctx.page
  await openPicker(page)
  const dialog = await addKeyInSettings(page, 'Unsplash', 'Access key')
  // Before a search, Unsplash's editorial feed.
  await expect(dialog.getByRole('option')).toHaveCount(1)

  await dialog.getByRole('textbox', { name: 'Search photos...' }).fill('mountains')
  await expect(dialog.getByRole('option')).toHaveCount(2)
  expect(requests.unsplash).toEqual(['(picks)', 'mountains'])
  await dialog.getByRole('option').first().hover()
  await expect(dialog).toContainText('Photo by Ann Lee on Unsplash')

  await dialog.getByRole('option').first().click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await imageFill(page))?.imageHash).toBeTruthy()
  // Unsplash's API terms ask to be told of every photo used.
  await expect.poll(() => requests.reported).toEqual(['/photos/first/download'])
})

test('switching to a service without a key asks for that one, and its photo fills the layer', async () => {
  const page = ctx.page
  const picker = await openPicker(page)
  await picker.getByRole('combobox', { name: 'Photo service' }).click()
  await page.getByRole('option', { name: 'Pexels' }).click()
  const dialog = await addKeyInSettings(page, 'Pexels', 'API key')
  // Before a search, Pexels' curated photos.
  await expect(dialog.getByRole('option')).toHaveCount(1)

  await dialog.getByRole('textbox', { name: 'Search photos...' }).fill('forest')
  await expect.poll(() => requests.pexels).toEqual(['(picks)', 'forest'])
  await dialog.getByRole('option').first().click()
  await expect.poll(async () => (await imageFill(page))?.imageHash).toBeTruthy()
  expect(requests.reported).toEqual([])
})

test('the picker opens on a service with a key when the last one searched has none', async () => {
  const page = ctx.page
  const picker = await openPicker(page)
  await expect(picker.getByRole('combobox', { name: 'Photo service' })).toHaveText('Pexels')
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()

  // Pexels was searched last; its key goes, Unsplash's stays.
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
  await page.getByTestId('settings-section-services').click()
  await page
    .getByTestId('settings-media-panel')
    .getByRole('button', { name: /Pexels/ })
    .click()
  await page.getByTestId('provider-settings-clear-key').click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByTestId('app-settings-done').click()

  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('fill-picker-stock-photo').click()
  await expect(picker.getByRole('combobox', { name: 'Photo service' })).toHaveText('Unsplash')
  await expect(picker.getByRole('option')).toHaveCount(1)
})

test('an image dropped on the image well fills the layer, and other files are left alone', async () => {
  const page = ctx.page
  await ctx.canvas.drawRect(120, 120, 160, 120)
  await page.getByTestId('fill-picker-swatch').first().click()
  await page.getByTestId('fill-picker-tab-image').click()
  const well = page.getByTestId('fill-picker-image-well')

  async function drop(name: string, type: string) {
    return well.evaluate(
      async (target, file) => {
        const canvas = new OffscreenCanvas(8, 8)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas context unavailable')
        context.fillRect(0, 0, 8, 8)
        const transfer = new DataTransfer()
        transfer.items.add(
          new File([await canvas.convertToBlob({ type: 'image/png' })], file.name, {
            type: file.type
          })
        )
        const options = { bubbles: true, cancelable: true, dataTransfer: transfer }
        target.dispatchEvent(new DragEvent('dragenter', options))
        const accepted = !target.dispatchEvent(new DragEvent('dragover', options))
        target.dispatchEvent(new DragEvent('drop', options))
        return accepted
      },
      { name, type }
    )
  }

  await drop('anim.gif', 'image/gif')
  expect((await imageFill(page))?.imageHash).toBeFalsy()
  expect(await drop('photo.png', 'image/png')).toBe(true)
  await expect.poll(async () => (await imageFill(page))?.imageHash).toBeTruthy()
})
