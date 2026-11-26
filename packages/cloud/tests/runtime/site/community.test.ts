import { describe, expect, test } from 'bun:test'

import type { CommunityDocument } from '#cloud/contract'
import { communityDocumentDescription } from '#cloud/runtime/site/community/content'
import { createCloudServer, type SiteFiles } from '#cloud/runtime/site/server'

const DOCUMENT_ID = '0b6f4f9e-3c1a-4d7e-9a52-6f1c2d3e4f50'
const REVISION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'
const VERSION_ID = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d'

const portal =
  '<!doctype html><html><head><title>OpenPencil Cloud</title></head><body><div id="app"></div></body></html>'
const site: SiteFiles = async (path) =>
  path === '/cloud.html'
    ? { body: Uint8Array.from(new TextEncoder().encode(portal)), type: 'text/html' }
    : null

function server(
  gallery: boolean | 'limited',
  name = 'Tour <of> "OpenPencil"',
  indexingPolicy: 'allow' | 'deny' = 'allow'
) {
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
            versions: [
              {
                id: VERSION_ID,
                name: '0.17.0',
                description: 'Notes </script><b>bold</b>',
                createdAt: '2026-11-14T00:00:00.000Z',
                current: true
              }
            ]
          }
        ]
      })
    }
  }
  return createCloudServer(api, { site, indexingPolicy, publicURL: 'https://cloud.example' })
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

/** A page's one structured data block: its nonce, and its graph as parsed JSON. */
function structuredData(html: string) {
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json" nonce="([^"]+)">([\s\S]*?)<\/script>/g)
  ]
  expect(blocks).toHaveLength(1)
  const [, nonce = '', json = ''] = blocks[0] ?? []
  const graph: unknown = JSON.parse(json)
  return { nonce, graph }
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

  test('draw the document into the app root, escaped, for crawlers that run no script', async () => {
    const html = await (await visit(server(true), `/community/${DOCUMENT_ID}`)).text()
    const root = html.slice(html.indexOf('<div id="app">'), html.indexOf('</body>'))
    expect(root).toContain('<h1>Tour &lt;of&gt; &quot;OpenPencil&quot;</h1>')
    expect(root).toContain(`href="/community/${DOCUMENT_ID}/open"`)
    expect(root).toContain('<time datetime="2026-11-14T00:00:00.000Z">0.17.0</time>')
    expect(root).not.toContain('<b>bold</b>')
  })

  test('describe the document as structured data that cannot close its script', async () => {
    const html = await (await visit(server(true), `/community/${DOCUMENT_ID}`)).text()
    const { graph } = structuredData(html)
    const url = `https://cloud.example/community/${DOCUMENT_ID}`
    expect(graph).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebPage',
          url,
          dateModified: expect.any(String),
          mainEntity: { '@id': `${url}#main-entity` }
        }),
        expect.objectContaining({
          '@id': `${url}#main-entity`,
          '@type': 'CreativeWork',
          name: 'Tour <of> "OpenPencil"',
          description: 'Notes </script><b>bold</b>',
          url,
          version: '0.17.0'
        })
      ])
    })
  })

  test('name each page’s structured data by its own address', async () => {
    const html = await (await visit(server(true), `/community/${DOCUMENT_ID}`)).text()
    const gallery = await (await visit(server(true), '/community')).text()
    expect(structuredData(html).graph).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({ '@id': `https://cloud.example/community/${DOCUMENT_ID}#webpage` })
      ])
    })
    expect(structuredData(gallery).graph).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({ '@id': 'https://cloud.example/community#webpage' })
      ])
    })
  })

  test('keep a name with template tokens as it is, in the title and the structured data', async () => {
    const name = 'Plan %separator draft %s %20'
    const page = await visit(server(true, name), `/community/${DOCUMENT_ID}`)
    const html = await page.text()
    expect(html).toContain(`<title>${name} · Community · cloud.example</title>`)
    expect(structuredData(html).graph).toMatchObject({
      '@graph': expect.arrayContaining([expect.objectContaining({ '@type': 'CreativeWork', name })])
    })
  })

  test('let only the structured data carrying this response’s nonce run inline', async () => {
    const app = server(true)
    const nonces = []
    for (const path of [`/community/${DOCUMENT_ID}`, '/community']) {
      const page = await visit(app, path)
      const policy = page.headers.get('Content-Security-Policy') ?? ''
      const { nonce } = structuredData(await page.text())
      expect(policy).toContain(`'nonce-${nonce}'`)
      expect(policy).not.toContain('unsafe-inline')
      expect(policy).toContain("frame-ancestors 'none'")
      nonces.push(nonce)
    }
    expect(new Set(nonces).size).toBe(2)
  })

  test('list the gallery’s files with links to their pages', async () => {
    const html = await (await visit(server(true), '/community')).text()
    expect(html).toContain(`href="/community/${DOCUMENT_ID}"`)
    expect(structuredData(html).graph).toMatchObject({
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          '@type': 'CollectionPage',
          url: 'https://cloud.example/community',
          mainEntity: { '@id': 'https://cloud.example/community#main-entity' }
        }),
        expect.objectContaining({
          '@id': 'https://cloud.example/community#main-entity',
          '@type': 'ItemList',
          itemListElement: [
            expect.objectContaining({
              position: 1,
              url: `https://cloud.example/community/${DOCUMENT_ID}`
            })
          ]
        })
      ])
    })
  })

  test('list the gallery’s pages in a sitemap where indexing is allowed', async () => {
    const sitemap = await server(true).request('https://cloud.example/sitemap.xml')
    expect(sitemap.headers.get('Content-Type')).toContain('application/xml')
    const xml = await sitemap.text()
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')
    expect(xml).toContain('<loc>https://cloud.example/community</loc>')
    expect(xml).toContain(
      `<url><loc>https://cloud.example/community/${DOCUMENT_ID}</loc><lastmod>2026-11-14T00:00:00.000Z</lastmod></url>`
    )
    const denied = server(true, 'Tour', 'deny')
    expect((await denied.request('https://cloud.example/sitemap.xml')).status).toBe(404)
  })

  test('name addresses from the public URL, not a host a proxy forwards to', async () => {
    const internal = new Request(`http://10.0.0.5:3000/community/${DOCUMENT_ID}`, {
      headers: { Accept: 'text/html' }
    })
    const head = await headOf(await server(true).request(internal))
    expect(head.canonical).toBe(`https://cloud.example/community/${DOCUMENT_ID}`)
    expect(head.meta['og:image']).toStartWith('https://cloud.example/api/community/thumbnails/')
    const xml = await (await server(true).request('http://10.0.0.5:3000/sitemap.xml')).text()
    expect(xml).not.toContain('10.0.0.5')
    expect(xml).toContain('<loc>https://cloud.example/community</loc>')
  })

  test('keep the API’s status and retry advice for the sitemap, and 404 without a gallery', async () => {
    const limited = await server('limited').request('https://cloud.example/sitemap.xml')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('Retry-After')).toBe('30')
    expect((await server(false).request('https://cloud.example/sitemap.xml')).status).toBe(404)
  })

  test('say what a file is from its description, else its newest version’s notes', () => {
    const document: CommunityDocument = {
      id: DOCUMENT_ID,
      name: 'Tour',
      description: 'A tour of the editor.',
      kind: 'design',
      updatedAt: '2026-11-14T00:00:00.000Z',
      revisionId: REVISION_ID,
      thumbnailPath: '',
      versions: [
        {
          id: VERSION_ID,
          name: '0.17.0',
          description: 'What changed',
          createdAt: '2026-11-14T00:00:00.000Z',
          current: true
        }
      ]
    }
    expect(communityDocumentDescription(document)).toBe('A tour of the editor.')
    expect(communityDocumentDescription({ ...document, description: null })).toBe('What changed')
    expect(communityDocumentDescription({ ...document, description: null, versions: [] })).toBe(
      'Tour, a file to open in OpenPencil and copy into your own workspace.'
    )
  })
})
