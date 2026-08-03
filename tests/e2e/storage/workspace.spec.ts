import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { unzipSync, zipSync } from 'fflate'

import { CanvasHelper } from '#tests/helpers/canvas'

async function configureStorage(page: Page): Promise<void> {
  await page.goto('/storage?test')
  await page.getByRole('button', { name: 'Settings' }).last().click()
  await page.getByLabel('Endpoint').fill('https://s3.example.com')
  await page.getByLabel('Bucket').fill('designs')

  for (const [field, value] of [
    ['access-key-id', 'access-key'],
    ['secret-access-key', 'secret-key']
  ] as const) {
    const container = page.locator(`[data-credential="${field}"]`)
    await container.locator('input').fill(value)
    await container.getByRole('button', { name: 'Save' }).click()
  }

  await page.getByTestId('settings-storage-open-workspace').click()
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
}

test('configured storage lists and opens a remote document', async ({ page }) => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
  const thumbnail = readFileSync('tests/fixtures/vectorize/euro_shield.png')
  await page.route('https://s3.example.com/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: `<ListBucketResult>
          <IsTruncated>false</IsTruncated>
          <Contents>
            <Key>open_pencil_storage/canvases/remote-1.fig</Key>
            <LastModified>2026-01-02T03:04:05.000Z</LastModified>
            <Size>${fixture.byteLength}</Size>
          </Contents>
        </ListBucketResult>`
      })
      return
    }
    if (url.pathname.endsWith('/remote-1.meta.json')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ name: 'Remote design', updatedAt: '2026-01-02T03:04:05.000Z' })
      })
      return
    }
    if (url.pathname.endsWith('/remote-1.thumb.jpg')) {
      await route.fulfill({ contentType: 'image/png', body: thumbnail })
      return
    }
    if (url.pathname.endsWith('/remote-1.fig')) {
      await route.fulfill({ contentType: 'application/octet-stream', body: fixture })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await configureStorage(page)
  const canvas = new CanvasHelper(page)
  await expect(page.getByText('Remote design')).toBeVisible()
  await expect(
    page.locator('[data-document-id="remote-1"] [data-slot="storage-thumbnail"] > img').first()
  ).toBeVisible()
  await expect(
    page.locator(
      '[data-document-id="remote-1"] [data-slot="storage-format-badge"][data-format="fig"]'
    )
  ).toBeVisible()

  await page.locator('[data-document-id="remote-1"]').click()
  await expect(page).toHaveURL(/\/editor$/)
  await canvas.waitForInit()
  await expect(page.getByText('Remote design').first()).toBeVisible()
})

test('dropping a deck stores its format and generated thumbnail', async ({ page }) => {
  const fixtureArchive = unzipSync(readFileSync('tests/fixtures/deck/css-filter-roundtrip.deck'))
  fixtureArchive['thumbnail.png'] = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xv1ZAAAAAElFTkSuQmCC',
      'base64'
    )
  )
  const fixture = zipSync(fixtureArchive)
  const puts: Array<{ url: string; body: Buffer | null }> = []

  await page.route('https://s3.example.com/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'PUT') {
      puts.push({ url: request.url(), body: request.postDataBuffer() })
      await route.fulfill({ status: 200 })
      return
    }
    if (url.searchParams.get('list-type') === '2') {
      await route.fulfill({
        contentType: 'application/xml',
        body: '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
      })
      return
    }
    if (url.pathname.endsWith('.fig')) {
      await route.fulfill({ contentType: 'application/octet-stream', body: fixture })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await configureStorage(page)
  const workspace = page.getByTestId('storage-workspace')
  await workspace.evaluate(
    (element, fileBytes) => {
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([new Uint8Array(fileBytes)], 'Dropped presentation.deck', {
          type: 'application/octet-stream'
        })
      )
      const options = { bubbles: true, cancelable: true, dataTransfer: transfer }
      element.dispatchEvent(new DragEvent('dragenter', options))
      element.dispatchEvent(new DragEvent('dragover', options))
      element.dispatchEvent(new DragEvent('drop', options))
    },
    [...fixture]
  )

  const card = page.getByRole('button', { name: /Dropped presentation/ })
  await expect(card).toBeVisible()
  await expect(card.locator('[data-slot="storage-thumbnail"] > img').first()).toBeVisible()
  await expect(card.locator('[data-slot="storage-format-badge"][data-format="deck"]')).toBeVisible()
  await expect
    .poll(() => puts.find((put) => put.url.endsWith('.meta.json'))?.body?.toString() ?? '')
    .toContain('"sourceFormat":"deck"')
  await expect.poll(() => puts.some((put) => put.url.endsWith('.thumb.jpg'))).toBe(true)

  await card.click()
  await expect(page).toHaveURL(/\/editor$/)
  await new CanvasHelper(page).waitForInit()
  await expect(page.getByRole('button', { name: 'Present' })).toBeVisible()
})

test('an unconfigured workspace is usable, not a dead end', async ({ page }) => {
  await page.goto('/?test')

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  // The old copy told first-time users to configure storage before doing
  // anything, which made a workspace that already worked look broken.
  await expect(page.getByText('Working offline — no cloud connected')).toBeVisible()
  await expect(page.getByTestId('storage-new-design')).toBeEnabled()
  await expect(page.getByTestId('storage-new-slides')).toBeEnabled()

  // Cloud is offered, never demanded.
  await page.getByRole('button', { name: 'Cloud storage' }).last().click()
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})
