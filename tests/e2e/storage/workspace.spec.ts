import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { openSettings } from '#tests/helpers/menu'

test('configured storage lists previews through ranges before opening the document', async ({
  page
}) => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
  let fullDocumentGets = 0
  let rangeGets = 0
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
    if (url.pathname.endsWith('/remote-1.fig') && route.request().headers().range) {
      const range = route.request().headers().range
      const explicit = range?.match(/^bytes=(\d+)-(\d+)$/)
      const suffix = range?.match(/^bytes=-(\d+)$/)
      let start: number
      let end: number
      if (explicit) {
        start = Number(explicit[1])
        end = Math.min(Number(explicit[2]), fixture.byteLength - 1)
      } else if (suffix) {
        const length = Math.min(Number(suffix[1]), fixture.byteLength)
        start = fixture.byteLength - length
        end = fixture.byteLength - 1
      } else {
        await route.fulfill({ status: 416 })
        return
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
        await route.fulfill({ status: 416 })
        return
      }
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fixture.byteLength}`
        },
        contentType: 'application/octet-stream',
        body: fixture.subarray(start, end + 1)
      })
      rangeGets++
      return
    }
    if (url.pathname.endsWith('/remote-1.fig') && route.request().method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Length': String(fixture.byteLength) }
      })
      return
    }
    if (url.pathname.endsWith('/remote-1.fig')) {
      fullDocumentGets++
      await route.fulfill({ contentType: 'application/octet-stream', body: fixture })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await page.goto('/storage?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('tabbar-home').click()
  await page.getByTestId('recent-files-home').getByRole('button', { name: 'Settings' }).click()
  await page.getByTestId('settings-section-storage').click()
  const panel = page.getByTestId('settings-storage-panel')
  await panel.getByRole('button', { name: /S3 storage/ }).click()
  await panel.getByLabel('Endpoint').fill('https://s3.example.com')
  await panel.getByLabel('Bucket').fill('designs')
  await panel.getByLabel('Access key ID').fill('access-key')
  await panel.getByLabel('Secret access key').fill('secret-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await page.getByTestId('settings-storage-open-workspace').click()
  await expect(page.getByTestId('recent-files-home')).toBeVisible()
  const entry = page.getByRole('button', { name: /Remote design/ })
  await expect(entry).toBeVisible()
  const preview = entry.locator('img')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('src', /^blob:/)
  expect(rangeGets).toBe(3)
  expect(fullDocumentGets).toBe(0)

  await entry.click()
  await expect(page).toHaveURL(/\/$/)
  await canvas.waitForInit()
  await expect(page.getByText('Remote design').first()).toBeVisible()
  expect(fullDocumentGets).toBe(1)
})

test('the library keeps designs on this device until storage is set up', async ({ page }) => {
  await page.goto('/storage?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('tabbar-home').click()

  const home = page.getByTestId('recent-files-home')
  await expect(home).toBeVisible()
  await expect(home.getByTestId('home-library-location')).toHaveText('Saved on this device')
  await expect(page.getByTestId('home-new-document')).toBeEnabled()

  await home.getByRole('button', { name: 'Settings' }).click()
  await page.getByTestId('settings-section-storage').click()
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})

test('setting up storage syncs the designs already in the library', async ({ page }) => {
  const objects = new Map<string, Buffer>()
  await page.route('https://s3.example.com/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const key = decodeURIComponent(url.pathname.replace(/^\/designs\/?/, ''))
    const prefix = url.searchParams.get('prefix')
    if (url.searchParams.get('list-type') === '2' && prefix !== null) {
      const contents = [...objects]
        .filter(([name]) => name.startsWith(prefix))
        .map(
          ([name, body]) =>
            `<Contents><Key>${name}</Key><LastModified>2026-01-02T03:04:05.000Z</LastModified><Size>${body.byteLength}</Size></Contents>`
        )
      await route.fulfill({
        contentType: 'application/xml',
        body: `<ListBucketResult><IsTruncated>false</IsTruncated>${contents.join('')}</ListBucketResult>`
      })
      return
    }
    if (request.method() === 'PUT') {
      objects.set(key, request.postDataBuffer() ?? Buffer.alloc(0))
      await route.fulfill({ status: 200, headers: { ETag: '"etag"' } })
      return
    }
    const body = objects.get(key)
    if (!body) {
      await route.fulfill({ status: 404 })
      return
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Length': String(body.byteLength) },
      body: request.method() === 'HEAD' ? undefined : body
    })
  })

  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  // Edited before storage exists: the design saves itself to the library on this device.
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.createShape('RECTANGLE', 100, 100, 100, 100)
    store.renameDocument('Synced later')
    await store.persistNow()
  })
  expect(objects.size).toBe(0)

  await openSettings(page)
  await page.getByTestId('settings-section-storage').click()
  const panel = page.getByTestId('settings-storage-panel')
  await panel.getByRole('button', { name: /S3 storage/ }).click()
  await panel.getByLabel('Endpoint').fill('https://s3.example.com')
  await panel.getByLabel('Bucket').fill('designs')
  await panel.getByLabel('Access key ID').fill('access-key')
  await panel.getByLabel('Secret access key').fill('secret-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByTestId('app-settings-done').click()

  // A versioned commit: a content-addressed body, an immutable manifest, and the head.
  await expect
    .poll(() => [...objects.keys()].filter((key) => !key.endsWith('.openpencil-namespace')).sort())
    .toEqual([
      expect.stringMatching(/^open_pencil_storage\/bodies\/sha256:[0-9a-f]+\.fig$/),
      expect.stringMatching(/^open_pencil_storage\/canvases\/[^/]+\/head\.json$/),
      expect.stringMatching(/^open_pencil_storage\/versions\/sha256:[0-9a-f]+\.json$/)
    ])
  const uploaded = [...objects].find(([key]) => key.endsWith('.fig'))?.[1]
  // An exported .fig is a zip archive holding the document and its thumbnail.
  expect(uploaded?.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))

  await page.getByTestId('tabbar-home').click()
  const home = page.getByTestId('recent-files-home')
  await expect(home.getByTestId('home-library-location')).toContainText('designs')
  await expect(home.getByRole('button', { name: /Synced later/ })).toBeVisible()
})
