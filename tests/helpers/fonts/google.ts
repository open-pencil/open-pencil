import type { Page, Route } from '@playwright/test'

/** Route-owned counts live in the runner, not on window or in a patched fetch. */
export async function mockGoogleFonts(page: Page, families = ['Inter', 'Lawha Google Font']) {
  const counts = { metadata: 0, previews: 0 }
  const pattern =
    /^https:\/\/(fonts\.lawha\.test\/|fonts\.google\.com\/metadata\/fonts|fonts\.googleapis\.com\/css2)/
  async function handle(route: Route) {
    const url = new URL(route.request().url())
    if (url.hostname === 'fonts.lawha.test') {
      counts.previews++
      await route.fulfill({ status: 200, body: Buffer.alloc(8) })
    } else if (url.hostname === 'fonts.google.com') {
      counts.metadata++
      await route.fulfill({
        json: {
          familyMetadataList: families.map((family) => ({ family, axes: [], fonts: { '400': {} } }))
        }
      })
    } else {
      const family = url.searchParams.get('family')?.split(':')[0] ?? 'Inter'
      await route.fulfill({
        contentType: 'text/css',
        body: `@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; src: url(https://fonts.lawha.test/${encodeURIComponent(family)}.ttf) format('truetype'); }`
      })
    }
  }
  await page.route(pattern, handle)
  return { counts, dispose: () => page.unroute(pattern, handle) }
}
