import { describe, expect, spyOn, test } from 'bun:test'

import {
  createCloudServer,
  inlineScriptHashes,
  siteContentSecurityPolicy,
  type SiteFiles
} from '#cloud/runtime/site/server'
import type { CloudErrorContext } from '#cloud/server'
import { sha256 } from '@noble/hashes/sha2.js'
import { fromUint8Array } from 'js-base64'

/** The inline script a page runs before it draws, which the policy names by its hash. */
const THEME = 'document.documentElement.dataset.theme = "dark"'
const themeHash = fromUint8Array(sha256(new TextEncoder().encode(THEME)))

const files: Record<string, string> = {
  '/cloud.html': `<!doctype html><title>Portal</title><script>${THEME}</script>`,
  '/index.html': '<!doctype html><title>Editor</title>',
  '/assets/cloud-abc.js': 'export {}',
  '/favicon.svg': '<svg/>'
}

const TYPES: Record<string, string> = { svg: 'image/svg+xml', html: 'text/html' }
const typeOf = (path: string) => TYPES[path.split('.').at(-1) ?? ''] ?? 'text/plain'

const site: SiteFiles = async (path) => {
  const text = files[path]
  return text === undefined
    ? null
    : { body: Uint8Array.from(new TextEncoder().encode(text)), type: typeOf(path) }
}

const api = {
  fetch: (request: Request) =>
    new URL(request.url).pathname === '/api/session'
      ? Response.json({ ok: true })
      : new Response('Not found', { status: 404 })
}

const server = createCloudServer(api, { site, indexingPolicy: 'deny' })
const request = (path: string, init: RequestInit = {}) =>
  server.request(new Request(`https://cloud.example${path}`, init))
const navigate = (path: string) => request(path, { headers: { Accept: 'text/html' } })

describe('Cloud server', () => {
  test('serves the portal at portal paths, never framed and never cached', async () => {
    const page = await request('/auth/device?user_code=ABCD')
    expect(await page.text()).toContain('Portal')
    expect(page.headers.get('Content-Security-Policy')).toBe(siteContentSecurityPolicy([themeHash]))
    expect(page.headers.get('Content-Security-Policy')).toContain(`'sha256-${themeHash}'`)
    expect(page.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    expect(page.headers.get('Cache-Control')).toBe('no-cache')
    expect((await request('/account')).status).toBe(200)
    expect(await (await request('/welcome')).text()).toContain('Portal')
  })

  test('serves the editor at the root and at any other page, never framed', async () => {
    for (const path of ['/', '/demo', '/documents/abc', '/share/abc']) {
      const page = await navigate(path)
      expect(await page.text()).toContain('Editor')
      expect(page.headers.get('Content-Security-Policy')).toBe(siteContentSecurityPolicy())
      expect(page.headers.get('Cache-Control')).toBe('no-cache')
    }
  })

  test('leaves other paths and methods to the API', async () => {
    expect(await (await navigate('/api/session')).json()).toEqual({ ok: true })
    expect((await request('/account', { method: 'POST' })).status).toBe(404)
    expect((await request('/missing.json')).status).toBe(404)
  })

  test('serves hashed assets as immutable and other files briefly cached where the API has nothing', async () => {
    const asset = await request('/assets/cloud-abc.js')
    expect(await asset.text()).toBe('export {}')
    expect(asset.headers.get('Cache-Control')).toContain('immutable')
    const icon = await request('/favicon.svg')
    expect(icon.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(icon.headers.get('Cache-Control')).not.toContain('immutable')
    expect((await request('/assets/missing.js')).status).toBe(404)
    // The service worker fetches the pages it keeps by their file names.
    expect((await request('/index.html')).headers.get('Cache-Control')).toBe('no-cache')
  })

  test('applies the indexing policy to every answer', async () => {
    for (const path of ['/', '/account', '/api/session', '/favicon.svg']) {
      expect((await navigate(path)).headers.get('X-Robots-Tag')).toContain('noindex')
    }
  })

  test('answers only the API without a site build', async () => {
    const bare = createCloudServer(api, { indexingPolicy: 'allow' })
    expect((await bare.request('https://cloud.example/account')).status).toBe(404)
    expect(
      (await bare.request('https://cloud.example/', { headers: { Accept: 'text/html' } })).status
    ).toBe(404)
  })

  test('reports a site file it fails to read and answers 500', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    const reported: { error: unknown; context: CloudErrorContext }[] = []
    const failure = new Error('assets unavailable')
    try {
      const failing = createCloudServer(api, {
        site: async () => {
          throw failure
        },
        indexingPolicy: 'deny',
        reportError: async (error, context) => {
          reported.push({ error, context })
        }
      })
      const response = await failing.request(new Request('https://cloud.example/favicon.svg'))
      expect(response.status).toBe(500)
      expect(reported).toEqual([
        { error: failure, context: { source: 'request', method: 'GET', route: '/*' } }
      ])
    } finally {
      logged.mockRestore()
    }
  })

  test('lets only the site’s own scripts run, never frames or plugins', () => {
    const directives = siteContentSecurityPolicy(['abc']).split('; ')
    expect(directives).toContain(
      "script-src 'self' 'sha256-abc' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://challenges.cloudflare.com"
    )
    expect(directives).toContain("worker-src 'self' blob:")
    expect(directives).toContain("object-src 'none'")
    expect(directives).toContain("base-uri 'self'")
    expect(directives).toContain("frame-ancestors 'none'")
  })

  test('hashes inline scripts in any case and with the line feeds a browser reads', async () => {
    const lf = fromUint8Array(sha256(new TextEncoder().encode('a()\nb()')))
    expect(
      await inlineScriptHashes('<SCRIPT>a()\r\nb()</SCRIPT><script src="/x.js"></script>')
    ).toEqual([lf])
  })
})
