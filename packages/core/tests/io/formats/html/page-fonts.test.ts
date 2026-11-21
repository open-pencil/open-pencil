import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import type { DesignDocument, DesignResourceFetch } from '@open-pencil/dom-css'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { loadPageFontFaces } from '#core/io/formats/html/page-fonts'
import { fontManager } from '#core/text/font/manager'

const FONT_URL = 'https://site.example.test/fonts/brand.ttf'

function page(family: string, sources: string[]): DesignDocument {
  return {
    type: 'document',
    children: [
      {
        type: 'element',
        tagName: 'p',
        attrs: {},
        children: [{ type: 'text', text: 'Hello' }],
        computedStyle: { 'font-family': `"${family}", sans-serif` }
      }
    ],
    fontFaces: [{ family, weight: 400, italic: false, sources }]
  }
}

describe('a page’s own fonts', () => {
  test('loads the faces its text uses, from the first source in a readable format', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const requested: string[] = []
    const fetch: DesignResourceFetch = async (url) => {
      requested.push(url)
      // An EOT first, as old icon fonts list, which the font manager does not read.
      if (url.endsWith('.eot')) return { url, bytes: new Uint8Array([1, 2, 3, 4]) }
      return url === FONT_URL ? { url, bytes: font } : null
    }

    const families = await loadPageFontFaces(
      page('Page Brand Sans', ['https://site.example.test/fonts/brand.eot', FONT_URL]),
      fetch
    )

    expect([...families.values()]).toEqual(['Page Brand Sans'])
    expect(requested).toEqual(['https://site.example.test/fonts/brand.eot', FONT_URL])
    expect(await fontManager.loadFont('Page Brand Sans', 'Regular')).not.toBeNull()
  })

  test('leaves out the faces of families no text uses', async () => {
    const requested: string[] = []
    const styled = page('Used Sans', [])
    styled.fontFaces = [{ family: 'Unused Sans', weight: 400, italic: false, sources: [FONT_URL] }]

    await loadPageFontFaces(styled, async (url) => {
      requested.push(url)
      return null
    })

    expect(requested).toEqual([])
  })

  test('sets text in the font the page serves, over the editor’s family of that name', async () => {
    const editors = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
    const pages = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    await fontManager.markLoaded('Shared Sans', 'Regular', editors)
    const requested: string[] = []

    await loadPageFontFaces(page('Shared Sans', [FONT_URL]), async (url) => {
      requested.push(url)
      return { url, bytes: pages }
    })

    // The page's file is what the page draws with; the editor's may be another design.
    expect(requested).toEqual([FONT_URL])
    expect(fontManager.loadedData('Shared Sans', 'Regular')?.byteLength).toBe(pages.byteLength)
  })

  test('takes a font the page loads from Google Fonts from the editor’s own copy', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    await fontManager.markLoaded('Provider Sans', 'Regular', font)
    const requested: string[] = []
    const subset = 'https://fonts.gstatic.com/s/providersans/v1/latin.woff2'

    const families = await loadPageFontFaces(page('Provider Sans', [subset]), async (url) => {
      requested.push(url)
      return null
    })

    expect([...families.values()]).toEqual(['Provider Sans'])
    expect(requested).toEqual([])
  })

  test('loads every subset a page splits one face into', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const subsets = [
      'https://site.example.test/fonts/latin.ttf',
      'https://site.example.test/fonts/greek.ttf'
    ]
    const requested: string[] = []
    const styled = page('Page Subset Sans', [subsets[0]])
    styled.fontFaces = subsets.map((url) => ({
      family: 'Page Subset Sans',
      weight: 400,
      italic: false,
      sources: [url]
    }))

    await loadPageFontFaces(styled, async (url) => {
      requested.push(url)
      return { url, bytes: font }
    })

    expect(requested).toEqual(subsets)
    // The later subset joins the first as a file the face draws its other characters from.
    expect(fontManager.shardData('Page Subset Sans', 'Regular')).toHaveLength(1)
  })

  test('passes over a source that does not decode for the next one', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const broken = 'https://site.example.test/fonts/broken.woff2'
    // A WOFF2 header over bytes that do not decompress.
    const bytes = new Uint8Array(64)
    bytes.set(new TextEncoder().encode('wOF2'))
    bytes.set([0, 1, 0, 0], 4)

    const families = await loadPageFontFaces(
      page('Page Fallback Sans', [broken, FONT_URL]),
      async (url) => (url === broken ? { url, bytes } : { url, bytes: font })
    )

    expect([...families.values()]).toEqual(['Page Fallback Sans'])
  })

  test('registers nothing once its import is cancelled', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const cancel = new AbortController()

    const loading = loadPageFontFaces(
      page('Page Cancelled Sans', [FONT_URL]),
      async (url) => {
        // The import is cancelled while the font is on its way.
        cancel.abort()
        return { url, bytes: font }
      },
      cancel.signal
    )

    await expect(loading).rejects.toThrow()
    expect(await fontManager.loadFont('Page Cancelled Sans', 'Regular')).toBeNull()
  })

  test('draws every weight a variable page font reaches from it', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()

    await loadPageFontFaces(page('Page Variable Sans', [FONT_URL]), async (url) => ({
      url,
      bytes: font
    }))

    // The rule names one weight; headings at 600 draw from the same file, as the browser draws them.
    expect(fontManager.loadedData('Page Variable Sans', 'SemiBold')?.byteLength).toBe(
      font.byteLength
    )
    expect(fontManager.loadedFontSource('Page Variable Sans', 'Bold')).toBe('registered')
  })

  test('keeps a weight another rule names in that rule’s own file', async () => {
    const variable = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const bold = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).bytes()
    const styled = page('Page Named Bold Sans', ['https://site.test/variable.ttf'])
    styled.fontFaces?.push({
      family: 'Page Named Bold Sans',
      weight: 700,
      italic: false,
      sources: ['https://site.test/bold.ttf']
    })

    await loadPageFontFaces(styled, async (url) => ({
      url,
      bytes: url.endsWith('bold.ttf') ? bold : variable
    }))

    // The variable file reaches 700, but the page names Bold's file itself, as the browser uses it.
    expect(fontManager.loadedData('Page Named Bold Sans', 'Bold')?.byteLength).toBe(bold.byteLength)
    expect(fontManager.loadedData('Page Named Bold Sans', 'SemiBold')?.byteLength).toBe(
      variable.byteLength
    )
  })
})
