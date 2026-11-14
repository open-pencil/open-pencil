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

/** What a page's head holds, as written: its titles, metas by name or property, and canonical link. */
async function headOf(page: Response) {
  const head = { titles: [] as string[], meta: {} as Record<string, string>, canonical: '' }
  let title = ''
  await new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text
        if (chunk.lastInTextNode) {
          head.titles.push(title)
          title = ''
        }
      }
    })
    .on('meta', {
      element(element) {
        const key = element.getAttribute('property') ?? element.getAttribute('name')
        if (key) head.meta[key] = element.getAttribute('content') ?? ''
      }
    })
    .on('link[rel="canonical"]', {
      element(element) {
        head.canonical = element.getAttribute('href') ?? ''
      }
    })
    .transform(page)
    .text()
  return head
}

describe('community pages', () => {
  test('describe a document to link previews, escaped, with its preview as the image', async () => {
    const page = await visit(server(true), `/community/${DOCUMENT_ID}`)
    expect(page.status).toBe(200)
    const head = await headOf(page)
    // One title, the file's, whatever its name holds; the page's own is replaced.
    expect(head.titles).toEqual([
      'Tour &lt;of&gt; &quot;OpenPencil&quot; · Community · cloud.example'
    ])
    // As written in the page, which keeps the quotes in the attribute escaped.
    expect(head.meta['og:title']).toBe(
      'Tour <of> &quot;OpenPencil&quot; · Community · cloud.example'
    )
    expect(head.meta['og:image']).toBe(
      `https://cloud.example/api/community/thumbnails/${DOCUMENT_ID}/${REVISION_ID}`
    )
    expect(head.canonical).toBe(`https://cloud.example/community/${DOCUMENT_ID}`)
    expect(page.headers.get('X-Robots-Tag')).toBeNull()
  })

  test('describe the gallery itself', async () => {
    const head = await headOf(await visit(server(true), '/community'))
    expect(head.titles).toEqual(['Community · cloud.example'])
    expect(head.canonical).toBe('https://cloud.example/community')
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
    const head = await headOf(
      await visit(server(true, 'Price $& $` $$'), `/community/${DOCUMENT_ID}`)
    )
    expect(head.meta['og:title']).toBe('Price $& $` $$ · Community · cloud.example')
  })
})
