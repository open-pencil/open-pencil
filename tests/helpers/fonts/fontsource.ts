import type { Page, Route } from '@playwright/test'

interface FontsourceFixture {
  family: string
  subset: string
  data: Buffer
  format?: 'ttf' | 'otf'
}

/** Use real font bytes through the browser-enabled provider, without external network requests. */
export async function mockFontsource(page: Page, fixtures: readonly FontsourceFixture[]) {
  const counts = { downloads: 0 }
  const entries = new Map(fixtures.map((fixture, index) => [String(index), fixture]))
  const pattern =
    /^https:\/\/(api\.fontsource\.org\/v1\/fonts(?:\/|$)|cdn\.jsdelivr\.net\/fontsource\/fonts\/openpencil-fixture-)/
  const headers = { 'access-control-allow-origin': '*' }
  async function handle(route: Route) {
    const url = new URL(route.request().url())
    if (url.hostname === 'cdn.jsdelivr.net') {
      const fixture = entries.get(
        url.pathname.slice('/fontsource/fonts/openpencil-fixture-'.length, -4)
      )
      if (!fixture) throw new Error('Unknown fixture font')
      counts.downloads++
      await route.fulfill({
        body: fixture.data,
        contentType: `font/${fixture.format ?? 'ttf'}`,
        headers
      })
    } else if (url.pathname === '/v1/fonts') {
      await route.fulfill({
        headers,
        json: [...entries].map(([id, fixture]) => ({
          id,
          family: fixture.family,
          variable: false,
          weights: [400],
          styles: ['normal'],
          subsets: [fixture.subset],
          defSubset: fixture.subset
        }))
      })
    } else {
      const id = url.pathname.split('/').at(-1)
      const fixture = id === undefined ? undefined : entries.get(id)
      if (!fixture) throw new Error('Unknown fixture font metadata')
      await route.fulfill({
        headers,
        json: {
          unicodeRange: {},
          variants: {
            '400': {
              normal: {
                [fixture.subset]: {
                  url: {
                    [fixture.format ?? 'ttf']:
                      `https://cdn.jsdelivr.net/fontsource/fonts/openpencil-fixture-${id}.${fixture.format ?? 'ttf'}`
                  }
                }
              }
            }
          }
        }
      })
    }
  }
  await page.route(pattern, handle)
  return { counts, dispose: () => page.unroute(pattern, handle) }
}
