import { readFileSync } from 'node:fs'

import type { Page, Route } from '@playwright/test'

export const STORAGE_ORIGIN = 'https://s3.example.com'

export type StorageRequest = {
  method: string
  /** Object key without the namespace prefix, e.g. `remote-1.fig`. */
  key: string
  url: string
  byteLength: number
}

export type StorageTraffic = {
  /** Everything the app has asked the provider for, in order. */
  readonly requests: StorageRequest[]
  count(predicate?: (request: StorageRequest) => boolean): number
  /** Forget everything so far — the boundary between "loading" and "idle". */
  reset(): void
  /** Requests grouped by key, for reporting what unexpectedly moved. */
  summary(): string
}

export type StorageFixture = {
  /** Documents the bucket already contains, keyed by canvas id. */
  documents?: Record<string, { name: string; bytes: Uint8Array; updatedAt?: string }>
  /** Serve a thumbnail object for every document. */
  thumbnail?: Uint8Array
}

function keyOf(url: string): string {
  const { pathname } = new URL(url)
  const marker = 'open_pencil_storage/canvases/'
  const index = pathname.indexOf(marker)
  return index >= 0 ? pathname.slice(index + marker.length) : pathname
}

function listBody(fixture: StorageFixture): string {
  const entries = Object.entries(fixture.documents ?? {})
    .map(
      ([id, document]) => `<Contents>
        <Key>open_pencil_storage/canvases/${id}.fig</Key>
        <LastModified>${document.updatedAt ?? '2026-01-02T03:04:05.000Z'}</LastModified>
        <Size>${document.bytes.byteLength}</Size>
      </Contents>`
    )
    .join('')
  return `<ListBucketResult><IsTruncated>false</IsTruncated>${entries}</ListBucketResult>`
}

/**
 * Record every provider request and serve a fake bucket.
 *
 * Operation budgets are the only way to catch the defects this subsystem kept
 * producing: a rename that re-uploaded a 40 MB body, and an open document that
 * uploaded forever with no edits. Both leave correct end state, so assertions
 * about what the data looks like afterwards cannot see them. Only the COUNT of
 * requests can.
 */
export async function recordStorageTraffic(
  page: Page,
  fixture: StorageFixture = {}
): Promise<StorageTraffic> {
  const requests: StorageRequest[] = []
  const documents = fixture.documents ?? {}

  await page.route(`${STORAGE_ORIGIN}/**`, async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const key = keyOf(request.url())
    requests.push({
      method: request.method(),
      key,
      url: request.url(),
      byteLength: request.postDataBuffer()?.byteLength ?? 0
    })

    if (request.method() === 'PUT' || request.method() === 'DELETE') {
      await route.fulfill({ status: 200 })
      return
    }
    if (url.searchParams.get('list-type') === '2') {
      await route.fulfill({ contentType: 'application/xml', body: listBody(fixture) })
      return
    }
    const documentId = key.replace(/\.(fig|deck|meta\.json|thumb\.jpg)$/, '')
    const document = documents[documentId]
    if (key.endsWith('.meta.json') && document) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          name: document.name,
          updatedAt: document.updatedAt ?? '2026-01-02T03:04:05.000Z'
        })
      })
      return
    }
    if (key.endsWith('.thumb.jpg') && fixture.thumbnail) {
      await route.fulfill({ contentType: 'image/png', body: Buffer.from(fixture.thumbnail) })
      return
    }
    if ((key.endsWith('.fig') || key.endsWith('.deck')) && document) {
      await route.fulfill({
        contentType: 'application/octet-stream',
        body: Buffer.from(document.bytes)
      })
      return
    }
    await route.fulfill({ status: 404 })
  })

  return {
    requests,
    count: (predicate) => (predicate ? requests.filter(predicate).length : requests.length),
    reset: () => {
      requests.length = 0
    },
    summary: () =>
      requests.map((request) => `${request.method} ${request.key}`).join('\n') || '(none)'
  }
}

export function readFixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path))
}

/** Configure S3 credentials and land on the workspace. */
export async function configureStorage(page: Page): Promise<void> {
  await page.goto('/storage?test')
  await page.getByRole('button', { name: 'Settings' }).last().click()
  // Settings open on their first section — storage is no longer the default.
  await page.getByTestId('settings-section-storage').click()
  await page.getByLabel('Endpoint').fill(STORAGE_ORIGIN)
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
}
