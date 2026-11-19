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

  test('keeps the editor’s own copy of a family the page also ships', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    await fontManager.markLoaded('Editor Sans', 'Regular', font)
    const requested: string[] = []

    const families = await loadPageFontFaces(page('Editor Sans', [FONT_URL]), async (url) => {
      requested.push(url)
      return null
    })

    // The page's text is set in the family, from the editor's copy, and the page's is not read.
    expect([...families.values()]).toEqual(['Editor Sans'])
    expect(requested).toEqual([])
  })
})
