import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

import {
  configureStorage,
  readFixture,
  recordStorageTraffic,
  STORAGE_ORIGIN
} from '#tests/helpers/storage-traffic'

/**
 * Fault injection: every way a provider can reject us must reach a state the
 * user can SEE and ACT ON.
 *
 * A correct internal state is not the deliverable here. The engine can park a
 * job perfectly, record a perfect `SyncFailure`, and still leave a workspace
 * that looks fine — which is how a bucket that had rejected every write for a
 * week could sit behind a calm chip. These tests therefore only ever assert
 * through the surfaces a person actually looks at: the status strip, whether it
 * can be clicked, and what the detail dialog says.
 *
 * The provider's verbatim words are the load-bearing part. `missing scopes
 * (["buckets.write"])` is the only string in the whole failure that names the
 * fix; guidance may accompany it, never replace it.
 */

// A failure has to be observed reaching the UI, then observed retrying — both
// cost real elapsed time (the first backoff alone is ~1.5 s).
test.setTimeout(90_000)

const DOCUMENT_ID = 'remote-1'
const DOCUMENT_NAME = 'Remote design'

/** Verbatim provider text. If any of these strings is missing from the dialog,
 *  the user has lost the only actionable part of the message. */
const PERMISSION_MESSAGE =
  'Access Denied: key e2e-access-key is missing s3:PutObject on bucket designs'
const NOT_FOUND_MESSAGE = 'The specified bucket does not exist: designs-typo'
const SERVER_MESSAGE = 'Service is temporarily unable to handle your request. Please retry.'

function s3ErrorBody(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>${code}</Code><Message>${message}</Message><RequestId>E2E-REQUEST-ID</RequestId></Error>`
}

type Fault = { kind: 'status'; status: number; code: string; message: string } | { kind: 'abort' }

type FaultInjector = {
  /** Provider calls the fault has answered, so retry behaviour is observable. */
  attempts(): number
  /** Stop faulting — the queue must recover on its own from here. */
  heal(): void
}

/**
 * Fail the metadata write for one document, leaving every other call healthy.
 *
 * Scoped this tightly on purpose: failing everything also fails the listing and
 * the thumbnail upload, and the chip would then be red for reasons the test did
 * not choose. One rename, one job, one cause.
 *
 * Registration order matters and is easy to get backwards: Playwright consults
 * route handlers newest-first, so this must be installed AFTER the fixture
 * bucket or the fixture answers everything and no fault is ever injected.
 */
async function injectMetadataFault(page: Page, fault: Fault): Promise<FaultInjector> {
  let attempts = 0
  let healthy = false

  await page.route(`${STORAGE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    const isTarget =
      request.method() === 'PUT' &&
      new URL(request.url()).pathname.endsWith(`${DOCUMENT_ID}.meta.json`)
    if (!isTarget || healthy) {
      await route.fallback()
      return
    }
    attempts += 1
    if (fault.kind === 'abort') {
      // A rejected preflight and a dead host are indistinguishable from inside
      // the page: both surface as `TypeError: Failed to fetch`.
      await route.abort('failed')
      return
    }
    await route.fulfill({
      status: fault.status,
      contentType: 'application/xml',
      body: s3ErrorBody(fault.code, fault.message)
    })
  })

  return {
    attempts: () => attempts,
    heal: () => {
      healthy = true
    }
  }
}

/** A healthy bucket holding one document, with the fault layered on top. */
async function openWorkspace(page: Page, fault: Fault): Promise<FaultInjector> {
  await recordStorageTraffic(page, {
    documents: {
      [DOCUMENT_ID]: { name: DOCUMENT_NAME, bytes: readFixture('tests/fixtures/gold-preview.fig') }
    },
    // Serve a preview so the grid never falls back to downloading whole
    // documents to draw itself — that backfill enqueues its own upload job.
    thumbnail: readFixture('tests/fixtures/vectorize/euro_shield.png')
  })
  const injector = await injectMetadataFault(page, fault)
  await configureStorage(page)
  await expect(page.getByTestId('storage-workspace')).toBeVisible()
  await expect(page.getByText(DOCUMENT_NAME)).toBeVisible()
  return injector
}

/** Rename — the smallest real mutation that queues exactly one upload. */
async function renameDocument(page: Page, name: string): Promise<void> {
  await page.locator(`[data-document-id="${DOCUMENT_ID}"]`).click({ button: 'right' })
  await page.getByTestId('storage-context-rename').click()
  const dialog = page.getByTestId('storage-rename-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox').fill(name)
  await dialog.getByRole('button', { name: 'Rename' }).click()
  await expect(dialog).not.toBeVisible()
}

/**
 * The whole point of the exercise: the strip has to raise an alarm, and the
 * alarm has to be a door. A red chip nobody can click is a decoration.
 */
async function openFailureDetail(page: Page): Promise<Locator> {
  const chip = page.getByTestId('cloud-workspace-status')
  await expect(chip).toHaveAttribute('data-indicator', /^(failing|degraded)$/)
  await expect(chip).toBeEnabled()
  await chip.click()
  const dialog = page.getByTestId('sync-error-dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

/** The `<section>` carrying guidance is the only element with `data-tone`. */
function guidanceOf(dialog: Locator): Locator {
  return dialog.locator('section[data-tone]')
}

test('a 403 names the missing permission in the provider’s own words', async ({ page }) => {
  const renamed = 'Renamed under a read-only key'
  const fault = await openWorkspace(page, {
    kind: 'status',
    status: 403,
    code: 'AccessDenied',
    message: PERMISSION_MESSAGE
  })
  await renameDocument(page, renamed)

  const dialog = await openFailureDetail(page)
  expect(fault.attempts()).toBeGreaterThan(0)

  // Which operation failed, and to which document, so the user is not left
  // guessing what is at risk.
  await expect(dialog).toContainText('Updating document details')
  await expect(dialog).toContainText(renamed)

  // Guidance explains the SHAPE of the problem…
  await expect(guidanceOf(dialog)).toContainText('not allowed to perform this operation')
  // …and the provider names the actual fix. Both, never one.
  await expect(dialog.getByTestId('sync-error-raw')).toContainText(PERMISSION_MESSAGE)

  // Every dead end here has a next step attached.
  await expect(dialog.getByTestId('sync-error-retry')).toBeEnabled()
  await expect(dialog.getByTestId('sync-error-open-settings')).toBeEnabled()
  await expect(dialog.getByTestId('sync-error-copy-details')).toBeEnabled()
})

test('a 404 points at the bucket, and still shows what the provider said', async ({ page }) => {
  await openWorkspace(page, {
    kind: 'status',
    status: 404,
    code: 'NoSuchBucket',
    message: NOT_FOUND_MESSAGE
  })
  await renameDocument(page, 'Renamed into a bucket that is gone')

  const dialog = await openFailureDetail(page)
  await expect(guidanceOf(dialog)).toContainText('bucket or object was not found')

  // KNOWN RED — product defect, not a test defect.
  //
  // `s3Request` returns 404 responses to the caller unparsed so GET/HEAD can
  // treat a missing object as `null` (client.ts, `if (res.ok || res.status ===
  // 404) return res`). Writes inherit that: `putObject` sees `!res.ok` and
  // throws `Failed to upload <key>`, so the provider's <Code>/<Message> —
  // "NoSuchBucket", which is the only text that distinguishes a wrong bucket
  // name from a wrong endpoint — never reaches the user. The dialog names the
  // key we tried to write, which they already knew.
  await expect(dialog.getByTestId('sync-error-raw')).toContainText(NOT_FOUND_MESSAGE)
})

test('a 503 keeps retrying and heals itself without the user', async ({ page }) => {
  const fault = await openWorkspace(page, {
    kind: 'status',
    status: 503,
    code: 'ServiceUnavailable',
    message: SERVER_MESSAGE
  })
  await renameDocument(page, 'Renamed during an outage')

  const dialog = await openFailureDetail(page)
  // A transient fault is still worth reporting: the user must be able to tell
  // "not saved yet" from "saved". But it must say retrying is the right move.
  await expect(guidanceOf(dialog)).toContainText('retrying is safe')
  await expect(dialog.getByTestId('sync-error-raw')).toContainText(SERVER_MESSAGE)

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()

  // Not parked: the queue keeps working the job with nobody touching it.
  // Parking a 503 is how a provider hiccup turned into a permanent stall that
  // only a manual "Retry now" could clear.
  const attemptsWhenReported = fault.attempts()
  await expect
    .poll(() => fault.attempts(), { timeout: 30_000 })
    .toBeGreaterThan(attemptsWhenReported)

  // …and when the provider comes back, so does the workspace — unattended.
  fault.heal()
  await expect
    .poll(() => page.getByTestId('cloud-workspace-status').getAttribute('data-indicator'), {
      timeout: 30_000
    })
    .toBe('synced')
  // The alarm is gone, so the door closes with it.
  await expect(page.getByTestId('cloud-workspace-status')).toBeDisabled()
})

test('a blocked fetch reads as CORS, not as offline, and keeps the raw error', async ({ page }) => {
  await openWorkspace(page, { kind: 'abort' })
  // The browser is online throughout — nothing here is an offline queue.
  expect(await page.evaluate(() => navigator.onLine)).toBe(true)
  await renameDocument(page, 'Renamed against a bucket with no CORS rule')

  const dialog = await openFailureDetail(page)

  // Offline is the one benign reading of `Failed to fetch`, and it is wrong
  // here: an offline queue heals itself, a missing CORS rule never will.
  await expect(dialog).not.toContainText('This device is offline')

  /*
   * KNOWN RED — product defect, not a test defect.
   *
   * This is the assertion the whole file exists for, and today the app gets it
   * exactly backwards: guidance REPLACES the provider's words instead of
   * accompanying them.
   *
   * `s3Request` catches the fetch-level rejection and rethrows
   * `new CloudCorsError(formatBrowserCorsHelpMessage())` — the original
   * `TypeError: Failed to fetch` is dropped on the floor, and the help sentence
   * takes its place as the error's `message`. Downstream,
   * `categorizeSyncFailure` recognises a fetch-level failure only via
   * `error instanceof TypeError`; `CloudCorsError` extends `Error`, and its
   * message matches none of the string rules, so the failure is categorised
   * `unknown`.
   *
   * The user therefore gets: no "Likely cause" section (unknown has no
   * guidance), no bucket CORS configuration to copy (gated on
   * `category === 'cors'`), and a "Provider error" box containing OpenPencil's
   * own advice. Every soft assertion below is currently failing; they are kept
   * whole because each one is separately load-bearing.
   */
  await expect.soft(guidanceOf(dialog)).toContainText('CORS')
  await expect.soft(dialog.getByTestId('sync-error-raw')).toContainText('Failed to fetch')

  // Guidance that can be acted on: the exact bucket configuration to paste,
  // carrying this origin — the value the user cannot look up for themselves.
  await expect.soft(dialog.getByTestId('sync-error-copy-cors')).toBeVisible()
  await expect.soft(dialog).toContainText(new URL(page.url()).origin)
})
