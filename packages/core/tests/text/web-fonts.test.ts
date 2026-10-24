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

describe('web fonts', () => {
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
