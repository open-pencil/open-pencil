import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { isVariableFont, isWOFF2, WebFontResolver } from '@open-pencil/core/text'

const FONT_URL = 'https://fonts.gstatic.com/s/test/faces.woff2'

interface Family {
  family: string
  axes: { tag: string; min: number; max: number }[]
}

/**
 * A resolver whose Google Fonts serves `families`, and Material Symbols from its icon catalogue,
 * every face as the variable WOFF2 fixture. It records each CSS request.
 */
async function googleResolver(families: Family[], icons: string[] = []) {
  const woff2 = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Faces.woff2')).arrayBuffer()
  const requests: URL[] = []
  const resolver = new WebFontResolver()
  resolver.setEnabled({ google: true })
  resolver.setRemoteFetch(async (input) => {
    const url = new URL(String(input))
    if (url.href.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({
        familyMetadataList: families.map((family) => ({
          ...family,
          fonts: { '400': {}, '700': {} }
        }))
      })
    if (url.href.startsWith('https://fonts.google.com/metadata/icons'))
      return new Response(`)]}'\n${JSON.stringify({ families: icons })}`)
    if (url.href.startsWith('https://fonts.googleapis.com/css2')) {
      requests.push(url)
      const family = url.searchParams.get('family')?.split(':')[0] ?? ''
      return new Response(
        `@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; src: url(${FONT_URL}) format('woff2'); }`
      )
    }
    if (url.href === FONT_URL) return new Response(woff2)
    return new Response(null, { status: 404 })
  })
  return { resolver, requests }
}

/**
 * A resolver whose Fontsource serves `family` as it serves a variable CJK family: a Latin file, and
 * its Japanese subset in numbered unicode-range shards with no file of the subset's own. It records
 * the font files downloaded.
 */
async function fontsourceResolver(family: string) {
  const woff2 = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Faces.woff2')).arrayBuffer()
  const id = family.toLowerCase().replaceAll(' ', '-')
  const downloads: string[] = []
  const resolver = new WebFontResolver()
  resolver.setEnabled({ fontsource: true })
  resolver.setRemoteFetch(async (input) => {
    const url = String(input)
    if (url === 'https://api.fontsource.org/v1/fonts')
      return Response.json([
        {
          id,
          family,
          subsets: ['japanese', 'latin'],
          weights: [100, 400, 900],
          styles: ['normal'],
          defSubset: 'latin',
          variable: true,
          category: 'sans-serif'
        }
      ])
    if (url === `https://api.fontsource.org/v1/variable/${id}`)
      return Response.json({ axes: { wght: { default: '400', min: '100', max: '900', step: '1' } } })
    if (url === `https://api.fontsource.org/v1/fonts/${id}`)
      return Response.json({
        unicodeRange: { '[0]': 'U+4e00-4fff', '[1]': 'U+3000-30ff', latin: 'U+0000-00ff' },
        variants: {}
      })
    if (url.startsWith('https://cdn.jsdelivr.net/')) {
      downloads.push(url.slice(url.lastIndexOf('/') + 1))
      return new Response(woff2.slice(0))
    }
    return new Response(null, { status: 404 })
  })
  return { resolver, downloads }
}

describe('web fonts', () => {
  test('downloads the files of a split family that hold the characters asked for', async () => {
    const family = 'Web Font Test Shards'
    const { resolver, downloads } = await fontsourceResolver(family)
    // ボ is in the second Japanese shard; A in the Latin file.
    await resolver.fetchFont([family], 'Regular', 'Aボ')
    expect(downloads.toSorted()).toEqual(['1-wght-normal.woff2', 'latin-wght-normal.woff2'])
  })

  test('downloads only the default file of a split family for characters no file holds', async () => {
    const family = 'Web Font Test Shards Uncovered'
    const { resolver, downloads } = await fontsourceResolver(family)
    // 語 asks for the Japanese shards, but the ones served stop short of it.
    await resolver.fetchFont([family], 'Regular', '語')
    expect(downloads).toEqual(['latin-wght-normal.woff2'])
  })

  test('loads a font served as WOFF2 as the TrueType font it holds', async () => {
    const family = 'Web Font Test WOFF2'
    const { resolver } = await googleResolver([{ family, axes: [] }])
    const font = (await resolver.fetchFont([family], 'Regular', ''))?.buffers[0]
    expect(font).toBeDefined()
    if (!font) return
    expect(isWOFF2(font)).toBe(false)
    expect(isVariableFont(font)).toBe(true)
  })

  test('asks Google for a variable family whole, every axis in the range Google lists', async () => {
    const family = 'Web Font Test Variable'
    const { resolver, requests } = await googleResolver([
      {
        family,
        axes: [
          { tag: 'opsz', min: 14, max: 32 },
          { tag: 'wght', min: 100, max: 900 }
        ]
      }
    ])
    await resolver.fetchFont([family], 'Bold', '')
    expect(requests.map((url) => url.searchParams.get('family'))).toContain(
      // unifont asks for the upright slant on the `ital` axis.
      `${family}:ital,opsz,wght@0,14..32,100..900`
    )
  })

  test('asks Google for the one weight of a static family', async () => {
    const family = 'Web Font Test Static'
    const { resolver, requests } = await googleResolver([{ family, axes: [] }])
    await resolver.fetchFont([family], 'Bold', '')
    expect(requests.map((url) => url.searchParams.get('family'))).toContain(
      `${family}:ital,wght@0,700`
    )
  })

  test('loads Material Symbols from Google’s icon catalogue with every axis', async () => {
    const family = 'Material Symbols Rounded'
    const { resolver, requests } = await googleResolver([], [family])
    const font = (await resolver.fetchFont([family], 'ExtraLight', ''))?.buffers[0]
    expect(font && isVariableFont(font)).toBe(true)
    expect(requests.map((url) => url.searchParams.get('family'))).toContain(
      `${family}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`
    )
  })
})
