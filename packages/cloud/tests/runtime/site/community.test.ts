import { describe, expect, test } from 'bun:test'

import { createCloudServer, type SiteFiles } from '#cloud/runtime/site/server'

const DOCUMENT_ID = '0b6f4f9e-3c1a-4d7e-9a52-6f1c2d3e4f50'
const REVISION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'

const portal =
  '<!doctype html><html><head><title>OpenPencil Cloud</title></head><body></body></html>'
const site: SiteFiles = async (path) =>
  path === '/cloud.html'
    ? { body: Uint8Array.from(new TextEncoder().encode(portal)), type: 'text/html' }
    : null

function server(gallery: boolean | 'limited', name = 'Tour <of> "OpenPencil"') {
  const api = {
    fetch: (request: Request) => {
      if (new URL(request.url).pathname !== '/api/community') {
        return new Response('Not found', { status: 404 })
      }
      if (!gallery) return Response.json({ error: { code: 'not_found' } }, { status: 404 })
      if (gallery === 'limited') {
        return Response.json(
          { error: { code: 'rate_limited' } },
          { status: 429, headers: { 'Retry-After': '30' } }
        )
      }
      return Response.json({
        documents: [
          {
            id: DOCUMENT_ID,
            name,
            kind: 'design',
            updatedAt: '2026-11-14T00:00:00.000Z',
            revisionId: REVISION_ID,
            thumbnailPath: `/api/community/thumbnails/${DOCUMENT_ID}/${REVISION_ID}`,
            versions: []
          }
        ]
      })
    }
  }
  return createCloudServer(api, { site, indexingPolicy: 'allow' })
}

const visit = (app: ReturnType<typeof server>, path: string) =>
  app.request(new Request(`https://cloud.example${path}`, { headers: { Accept: 'text/html' } }))

describe('community pages', () => {
  test('describe a document to link previews, escaped, with its preview as the image', async () => {
    const page = await visit(server(true), `/community/${DOCUMENT_ID}`)
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain(
      '<title>Tour &lt;of&gt; &quot;OpenPencil&quot; · Community · cloud.example</title>'
    )
    expect(html).not.toContain('<title>OpenPencil Cloud</title>')
    expect(html).toContain(
      `<meta property="og:image" content="https://cloud.example/api/community/thumbnails/${DOCUMENT_ID}/${REVISION_ID}" />`
    )
    expect(html).toContain(
      `<link rel="canonical" href="https://cloud.example/community/${DOCUMENT_ID}" />`
    )
    expect(page.headers.get('X-Robots-Tag')).toBeNull()
  })

  test('describe the gallery itself', async () => {
    const html = await (await visit(server(true), '/community')).text()
    expect(html).toContain('<title>Community · cloud.example</title>')
    expect(html).toContain('<link rel="canonical" href="https://cloud.example/community" />')
  })

  test('answer 404 for a document not in the gallery, and on a server without one', async () => {
    expect((await visit(server(true), '/community/someone-else')).status).toBe(404)
    expect((await visit(server(false), '/community')).status).toBe(404)
  })

  test('leave a document opened in the editor unindexed', async () => {
    const editor = await visit(server(true), `/community/${DOCUMENT_ID}/open`)
    expect(editor.headers.get('X-Robots-Tag')).toContain('noindex')
  })

  test('keep the API’s status and retry advice when it could not answer', async () => {
    const page = await visit(server('limited'), `/community/${DOCUMENT_ID}`)
    expect(page.status).toBe(429)
    expect(page.headers.get('Retry-After')).toBe('30')
  })

  test('insert a name with dollar patterns as it is', async () => {
    const html = await (
      await visit(server(true, 'Price $& $` $$'), `/community/${DOCUMENT_ID}`)
    ).text()
    expect(html).toContain('<title>Price $&amp; $` $$ · Community · cloud.example</title>')
  })
})
