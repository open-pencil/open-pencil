import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  configureStorage,
  readFixture,
  recordStorageTraffic,
  type StorageTraffic
} from '#tests/helpers/storage-traffic'

/**
 * Temporal budgets: how much traffic a period of TIME is allowed to cost.
 *
 * These can only exist at this layer. The idle loop originated in
 * `sceneVersion`, which a unit test does not reproduce — it needs a real
 * editor, a real render loop and real elapsed time. It was found by watching
 * a live bucket, and until now the fix rested on one manual observation.
 */

const IDLE_OBSERVATION_MS = 15_000

// These budgets deliberately spend real time — the defect they guard against is
// measured in elapsed seconds, not in operations. The default 15s cap is below
// a single observation window.
test.setTimeout(90_000)

function report(traffic: StorageTraffic): string {
  return `Unexpected provider traffic:\n${traffic.summary()}`
}

test('an open document at rest costs nothing', async ({ page }) => {
  const fixture = readFixture('tests/fixtures/gold-preview.fig')
  const traffic = await recordStorageTraffic(page, {
    documents: { 'remote-1': { name: 'Remote design', bytes: fixture } }
  })

  await configureStorage(page)
  await expect(page.getByText('Remote design')).toBeVisible()
  await page.locator('[data-document-id="remote-1"]').click()
  await new CanvasHelper(page).waitForInit()

  // Everything above is legitimate: listing, metadata, the body, the first
  // save. The budget applies to what happens AFTER the document settles.
  await page.waitForTimeout(3_000)
  traffic.reset()

  await page.waitForTimeout(IDLE_OBSERVATION_MS)

  // Autosave keys on `sceneVersion`, which `requestRender()` bumps from ~136
  // call sites. Uploading unconditionally on every bump wrote three objects as
  // DELETE+POST every few seconds for as long as a document stayed open.
  expect(traffic.count(), report(traffic)).toBe(0)
})

test('editing an idle document still uploads it', async ({ page }) => {
  // The counterpart to the budget above. A test that only asserts silence is
  // satisfied by an app that never syncs at all.
  const fixture = readFixture('tests/fixtures/gold-preview.fig')
  const traffic = await recordStorageTraffic(page, {
    documents: { 'remote-1': { name: 'Remote design', bytes: fixture } }
  })

  await configureStorage(page)
  await expect(page.getByText('Remote design')).toBeVisible()
  await page.locator('[data-document-id="remote-1"]').click()
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.waitForTimeout(3_000)
  traffic.reset()

  await canvas.drawRect(120, 120, 260, 240)
  await page.waitForTimeout(6_000)

  expect(traffic.count((request) => request.method === 'PUT')).toBeGreaterThan(0)
})

test('opening a workspace never downloads a document body', async ({ page }) => {
  // The placeholder thumbnail forced `StorageView` to fetch whole documents to
  // draw its grid, so a bucket of 200 documents cost 200 downloads to render.
  const fixture = readFixture('tests/fixtures/gold-preview.fig')
  const thumbnail = readFixture('tests/fixtures/vectorize/euro_shield.png')
  const documents = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      `remote-${index + 1}`,
      { name: `Remote design ${index + 1}`, bytes: fixture }
    ])
  )
  const traffic = await recordStorageTraffic(page, { documents, thumbnail })

  await configureStorage(page)
  await expect(page.getByText('Remote design 5')).toBeVisible()
  await page.waitForTimeout(2_000)

  const bodyGets = traffic.count(
    (request) => request.method === 'GET' && /\.(fig|deck)$/.test(request.key)
  )
  expect(bodyGets, report(traffic)).toBe(0)
})
