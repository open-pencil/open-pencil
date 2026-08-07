import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'
import { unzipSync, zipSync } from 'fflate'

import { CanvasHelper } from '#tests/helpers/canvas'

// These configure storage, list a bucket, download a fig and initialise
// CanvasKit before asserting anything. Measured at 20-22s, so the 15s default
// makes them flaky by duration rather than by behaviour — the same reason
// traffic-budgets.spec.ts raises its own.
test.setTimeout(60_000)

async function configureStorage(page: Page): Promise<void> {
  await page.goto('/storage?test')
  await page.getByRole('button', { name: 'Settings' }).last().click()
  // Settings open on their first section now that this button is the app's only
  // way in — it used to jump straight to storage.
  await page.getByTestId('settings-section-storage').click()
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

async function dropStorageFile(
  page: Page,
  fileBytes: Uint8Array,
  fileName: string
): Promise<DataTransfer['dropEffect']> {
  return page.getByTestId('storage-workspace').evaluate(
    (element, file) => {
      const transfer = new DataTransfer()
      let dropEffect: DataTransfer['dropEffect'] = 'none'
      // Chromium resets this property for synthetic drags. Intercept its setter
      // so the test observes what the app requested during `dragover`.
      Object.defineProperty(transfer, 'dropEffect', {
        get: () => dropEffect,
        set: (value: DataTransfer['dropEffect']) => {
          dropEffect = value
        }
      })
      transfer.items.add(
        new File([new Uint8Array(file.bytes)], file.name, {
          type: 'application/octet-stream'
        })
      )
      const options = { bubbles: true, cancelable: true, dataTransfer: transfer }
      element.dispatchEvent(new DragEvent('dragenter', options))
      element.dispatchEvent(new DragEvent('dragover', options))
      element.dispatchEvent(new DragEvent('drop', options))
      return dropEffect
    },
    { bytes: [...fileBytes], name: fileName }
  )
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
      // Buffer, not Uint8Array: route.fulfill rejects the latter, and the
      // versioned layout's HEAD bodies/*.fig is the first request to hit here.
      await route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from(fixture) })
      return
    }
    await route.fulfill({ status: 404 })
  })

  await configureStorage(page)
  await dropStorageFile(page, fixture, 'Dropped presentation.deck')

  const card = page.getByRole('button', { name: /Dropped presentation/ })
  await expect(card).toBeVisible()
  await expect(card.locator('[data-slot="storage-thumbnail"] > img').first()).toBeVisible()
  await expect(card.locator('[data-slot="storage-format-badge"][data-format="deck"]')).toBeVisible()
  // Versioned layout: the commit publishes a manifest, not a `.meta.json` sidecar.
  await expect
    .poll(() => puts.find((put) => put.url.includes('/versions/'))?.body?.toString() ?? '')
    .toContain('"sourceFormat":"deck"')
  await expect.poll(() => puts.some((put) => put.url.endsWith('.thumb.jpg'))).toBe(true)

  await card.click()
  await expect(page).toHaveURL(/\/editor$/)
  await new CanvasHelper(page).waitForInit()
  // By test id, not by name: role-name matching is substring, so 'Present'
  // also matched the tab's "Close Dropped presentation" button.
  await expect(page.getByTestId('present-button')).toBeVisible()
})

test('dropping a fig imports it as a design, not a deck', async ({ page }) => {
  // `.fig` was refused by the drop handler for no reason other than the filter:
  // the thumbnailer and the open path have always handled both formats.
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
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
  await dropStorageFile(page, fixture, 'Dropped design.fig')

  // The name keeps its extension off and the badge must say design, or the
  // document would open through the deck reader and fail.
  const card = page.getByRole('button', { name: /Dropped design/ })
  await expect(card).toBeVisible()
  await expect(card.locator('[data-slot="storage-format-badge"][data-format="fig"]')).toBeVisible()
  // Versioned layout: the commit publishes a manifest, not a `.meta.json` sidecar.
  await expect
    .poll(() => puts.find((put) => put.url.includes('/versions/'))?.body?.toString() ?? '')
    .toContain('"sourceFormat":"fig"')

  await card.click()
  await expect(page).toHaveURL(/\/editor$/)
  await new CanvasHelper(page).waitForInit()
})

test('an unconfigured workspace is usable, not a dead end', async ({ page }) => {
  await page.goto('/?test')

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  // The old copy told first-time users to configure storage before doing
  // anything, which made a workspace that already worked look broken.
  await expect(page.getByTestId('cloud-workspace-status')).toContainText(
    'No cloud configured · Local storage only'
  )

  // Honest about where the only copy lives, integrated into the empty state.
  const notice = page.getByTestId('local-durability-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute('data-placement', 'empty')
  await expect(notice).toContainText('New documents will be saved on this device.')
  await expect(page.getByRole('button', { name: 'Got it' })).toHaveCount(0)
  await expect(page.getByTestId('storage-new-design')).toBeEnabled()
  await expect(page.getByTestId('storage-new-slides')).toBeEnabled()

  // Cloud is offered, never demanded. Scope the click to the placeholder: the
  // status chip's hint contains "cloud storage" too, and an unscoped `.last()`
  // was hitting the footer rather than the offer under test.
  await notice.getByRole('button', { name: 'Cloud storage' }).click()
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})

test('an unconfigured workspace accepts dropped files into local storage', async ({ page }) => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
  await page.goto('/?test')

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  // `dropEffect = none` cancels a real browser drop before the drop handler can
  // import it. A synthetic drop still dispatches, so assert the handler's
  // requested effect as well as the resulting local document.
  await expect(dropStorageFile(page, fixture, 'Local design.fig')).resolves.toBe('copy')

  const card = page.getByRole('button', { name: /Local design/ })
  await expect(card).toBeVisible()
  await expect(card.locator('[data-slot="storage-format-badge"][data-format="fig"]')).toBeVisible()
})

test('a populated local-only workspace explains durability from the status chip', async ({
  page
}) => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')
  await page.goto('/?test')

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await dropStorageFile(page, fixture, 'Local design.fig')
  await expect(page.getByRole('button', { name: /Local design/ })).toBeVisible()

  // The grid starts at the top. A banner above it said what the footer already
  // says, and charged prime vertical space on every visit to say it.
  await expect(page.getByTestId('local-durability-notice')).toHaveCount(0)

  const status = page.getByTestId('cloud-workspace-status')
  await expect(status).toContainText('No cloud configured · Local storage only')
  await status.click()

  // Still honest about where the only copy lives — one click away, where a full
  // sentence fits without truncating into a 20px footer.
  const notice = page.getByTestId('local-durability-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute('data-placement', 'status')
  await expect(notice).toContainText('Safari may remove them after about 7 days')

  // Cloud is offered, never demanded.
  await notice.getByRole('button', { name: 'Cloud storage' }).click()
  await expect(page.getByTestId('settings-storage-panel')).toBeVisible()
})

test('emptying Trash requires confirmation and removes every trashed document', async ({
  page
}) => {
  await page.goto('/?test')
  await page.getByTestId('storage-new-design').click()

  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.drawRect(120, 120, 260, 240)
  await page.getByTestId('app-back-to-workspace').click()

  const card = page.locator('[data-document-id]').first()
  await expect(card).toBeVisible()
  await card.click({ button: 'right' })
  await page.getByTestId('storage-context-trash').click()
  await page
    .getByTestId('storage-delete-dialog')
    .getByRole('button', { name: 'Move to Trash' })
    .click()

  await page.getByTestId('storage-folder-trash').click()
  const emptyTrash = page.getByTestId('storage-empty-trash')
  await expect(emptyTrash).toBeVisible()

  await emptyTrash.click()
  const dialog = page.getByTestId('storage-delete-dialog')
  await expect(dialog.getByText('Empty Trash?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(card).toBeVisible()

  await emptyTrash.click()
  await dialog.getByRole('button', { name: 'Empty Trash' }).click()
  await expect(page.locator('[data-document-id]')).toHaveCount(0)
  await expect(page.getByText('Trash is empty.')).toBeVisible()
})

test('a blank Untitled leaves nothing behind, an edited one does', async ({ page }) => {
  await page.goto('/?test')

  // Create one, touch nothing, close it.
  await page.getByTestId('storage-new-design').click()
  await expect(page).toHaveURL(/\/editor$/)
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  // Longer than the 3s autosave debounce: the point is that waiting does not
  // help it, not that we outran it.
  await page.waitForTimeout(4_000)
  await page.getByTestId('tabbar-close').click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await expect(page.locator('[data-document-id]')).toHaveCount(0)

  // Same again, but draw something first.
  await page.getByTestId('storage-new-design').click()
  await canvas.waitForInit()
  await canvas.drawRect(120, 120, 260, 240)
  await page.waitForTimeout(4_000)
  await page.getByTestId('tabbar-close').click()

  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await expect(page.locator('[data-document-id]')).toHaveCount(1)
})

test('a document is renamed in its tab, and the new name sticks', async ({ page }) => {
  await page.goto('/?test')
  await page.getByTestId('storage-new-design').click()
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  // A blank document has no row to rename. Give it one edit so it earns one.
  await canvas.drawRect(120, 120, 260, 240)
  await page.waitForTimeout(4_000)

  const tab = page.getByTestId('tabbar-tab')
  await expect(tab).toContainText('Untitled')
  await tab.getByText('Untitled').dblclick()

  const input = page.getByTestId('tabbar-name-input')
  await expect(input).toBeFocused()
  // Opening selects the whole name, so typing replaces rather than appends.
  await page.keyboard.type('Quarterly Review 2026')
  await expect(input).toHaveValue('Quarterly Review 2026')
  await page.keyboard.press('Enter')
  await expect(tab).toContainText('Quarterly Review 2026')

  // The name has to reach storage: setting it in memory is not saving it, and
  // autosave keys on `sceneVersion`, which a rename never bumps.
  await page.getByTestId('app-back-to-workspace').click()
  await expect(page.getByRole('button', { name: /Quarterly Review 2026/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /Quarterly Review 2026/ })).toBeVisible()
})

test('escape abandons a tab rename', async ({ page }) => {
  await page.goto('/?test')
  await page.getByTestId('storage-new-design').click()
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  const tab = page.getByTestId('tabbar-tab')
  await tab.getByText('Untitled').dblclick()
  await page.keyboard.type('Discarded')
  await page.keyboard.press('Escape')
  await expect(tab).toContainText('Untitled')
})
