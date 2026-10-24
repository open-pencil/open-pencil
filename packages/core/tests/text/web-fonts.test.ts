import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { isVariableFont, isWOFF2, WebFontResolver } from '@open-pencil/core/text'

test('loads a web font served as WOFF2 as the TrueType font it holds', async () => {
  const woff2 = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Faces.woff2')).arrayBuffer()
  const family = 'Web Font Test WOFF2'
  const fontURL = 'https://fonts.gstatic.com/s/test/faces.woff2'
  const resolver = new WebFontResolver()
  resolver.setEnabled({ google: true })
  resolver.setRemoteFetch(async (input) => {
    const url = String(input)
    if (url.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({ familyMetadataList: [{ family, fonts: { '400': {} }, axes: [] }] })
    if (url.startsWith('https://fonts.googleapis.com/css2'))
      return new Response(
        `@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; src: url(${fontURL}) format('woff2'); }`
      )
    if (url === fontURL) return new Response(woff2)
    return new Response(null, { status: 404 })
  })

  const resolved = await resolver.fetchFont([family], 'Regular', '')
  const font = resolved?.buffers[0]
  expect(font).toBeDefined()
  if (!font) return
  expect(isWOFF2(font)).toBe(false)
  expect(isVariableFont(font)).toBe(true)
})
