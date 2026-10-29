import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core/text'

/** A font manager that asks no web provider, so a family's faces come from its catalog. */
function offlineManager() {
  const manager = new FontManager()
  manager.setOnlineFontProviders({})
  return manager
}

/** Records what it registers, so a second registration of a face's bytes shows up. */
function countingProvider() {
  const registrations = new Map<string, number>()
  const provider = {
    registerFont(_data: ArrayBuffer, family: string) {
      registrations.set(family, (registrations.get(family) ?? 0) + 1)
    }
  } as TypefaceFontProvider
  return { provider, registrations }
}

test('a face lookup that outlives a new catalog does not overwrite what the catalog says', async () => {
  const manager = offlineManager()
  const before = manager.familyFaces('Oswald')
  manager.setHostFontCatalog([{ family: 'Oswald', styles: ['Regular', 'Bold'] }])
  expect(await before).toBeNull()
  expect(manager.loadedFamilyFaces('Oswald')).toBeUndefined()
  expect(await manager.familyFaces('Oswald')).toEqual([
    { weight: 400, italic: false },
    { weight: 700, italic: false }
  ])
})

test('a new catalog tells listeners to ask for their families again', () => {
  const manager = offlineManager()
  let resets = 0
  const stop = manager.onFamilyFacesReset(() => resets++)
  manager.setHostFontCatalog([{ family: 'Oswald', styles: ['Regular'] }])
  stop()
  manager.setHostFontCatalog([])
  expect(resets).toBe(1)
})

test('repeated and concurrent fallback preparation reuses host font bytes', async () => {
  const manager = offlineManager()
  manager.setFallbackUserAgent('Windows')
  const reads = new Map<string, number>()
  manager.setHostFontLoader(async (family, style) => {
    const key = `${family}|${style}`
    reads.set(key, (reads.get(key) ?? 0) + 1)
    return new ArrayBuffer(16)
  })
  const prepare = () => manager.ensureFallbackPack(['cjk-sc'], '', new AbortController().signal)
  await Promise.all([prepare(), prepare(), prepare()])
  const first = manager.loadedData('Microsoft YaHei', 'Regular')
  for (let i = 0; i < 10; i++) await prepare()
  expect(first).not.toBeNull()
  expect(manager.loadedData('Microsoft YaHei', 'Regular')).toBe(first)
  expect(reads.get('Microsoft YaHei|Regular')).toBe(1)
  expect([...reads.values()].every((count) => count === 1)).toBe(true)
})

test('an unavailable host font can be retried and replacing its loader invalidates cached bytes', async () => {
  const manager = offlineManager()
  let reads = 0
  const data = new ArrayBuffer(16)
  manager.setHostFontLoader(async () => (++reads === 1 ? null : data))
  await expect(manager.loadFont('Host Retry', 'Regular')).resolves.toBeNull()
  await expect(manager.loadFont('Host Retry', 'Regular')).resolves.toBe(data)
  manager.setFallbackUserAgent('Windows')
  await manager.ensureFallbackPack(['cjk-sc'], '', new AbortController().signal)
  // Other bytes than the first loader's, which would otherwise be kept as the same file.
  const next = new Uint8Array(16).fill(1).buffer
  manager.setHostFontLoader(async () => next)
  await manager.ensureFallbackPack(['cjk-sc'], '', new AbortController().signal)
  expect(manager.loadedData('Microsoft YaHei', 'Regular')).toBe(next)
})

test('cancelled fallback preparation does not register a late host font', async () => {
  const manager = offlineManager()
  manager.setFallbackUserAgent('Windows')
  const data = Promise.withResolvers<ArrayBuffer | null>()
  manager.setHostFontLoader(() => data.promise)
  const controller = new AbortController()
  const pending = manager.ensureFallbackPack(['cjk-sc'], '', controller.signal)
  controller.abort()
  data.resolve(new ArrayBuffer(16))
  await expect(pending).rejects.toHaveProperty('name', 'AbortError')
  expect(manager.loadedData('Microsoft YaHei', 'Regular')).toBeNull()
})

test('macOS fallback preparation after a document edit reads and registers each face once', async () => {
  const manager = offlineManager()
  manager.setFallbackUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
  const { provider, registrations } = countingProvider()
  manager.attachProvider({} as CanvasKit, provider)
  const reads = new Map<string, number>()
  manager.setHostFontLoader(async (family, style) => {
    const key = `${family}|${style}`
    reads.set(key, (reads.get(key) ?? 0) + 1)
    return new ArrayBuffer(16)
  })

  // What the editor runs after every AI or MCP edit, with the characters its text needs.
  for (let i = 0; i < 5; i++) await manager.ensureFallbackPack(['cjk-tc'], '設計規範')

  expect(reads.size).toBeGreaterThan(0)
  expect([...reads.values()].every((count) => count === 1)).toBe(true)
  expect(registrations.size).toBe(reads.size)
  expect([...registrations.values()].every((count) => count === 1)).toBe(true)
})

test('a host read that outlives its loader never registers the replaced loader data', async () => {
  const manager = offlineManager()
  manager.setFallbackUserAgent('Windows')
  const previous = Promise.withResolvers<ArrayBuffer | null>()
  manager.setHostFontLoader(() => previous.promise)
  const preparing = manager.ensureFallbackPack(['cjk-sc'], '', new AbortController().signal)
  const replacement = new ArrayBuffer(16)
  manager.setHostFontLoader(async () => replacement)
  previous.resolve(new ArrayBuffer(16))
  await preparing

  expect(manager.loadedData('Microsoft YaHei', 'Regular')).toBeNull()

  await manager.ensureFallbackPack(['cjk-sc'], '', new AbortController().signal)
  expect(manager.loadedData('Microsoft YaHei', 'Regular')).toBe(replacement)
})

test('draws every weight its variable font covers from the one file, in the same slant', async () => {
  const manager = offlineManager()
  const variable = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await manager.markLoaded('Fonts Test Variable', 'Regular', variable)
  expect(await manager.loadFont('Fonts Test Variable', 'Bold')).toBe(variable)
  expect(manager.isStyleLoaded('Fonts Test Variable', 'Bold')).toBe(true)
  // The file is upright, so it does not stand in for an italic.
  expect(await manager.loadFont('Fonts Test Variable', 'Bold Italic')).toBeNull()
})

test('an installed face of the style comes before a variable file loaded for another style', async () => {
  const manager = offlineManager()
  const family = 'Fonts Test Installed First'
  const variable = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  const installed = await Bun.file(join(FIXTURES, 'fonts', 'InterRegular-Faces.ttf')).arrayBuffer()
  manager.setHostFontLoader(async (name, style) =>
    name === family && style === 'Regular' ? installed : null
  )
  await manager.markLoaded(family, 'Light', variable)
  expect(await manager.loadFont(family, 'Regular')).toBe(installed)
  // A weight nothing installs draws from the variable file.
  expect(await manager.loadFont(family, 'Bold')).toBe(variable)
})

test('a variable font shared with another weight still fetches the characters it lacks', async () => {
  const manager = new FontManager()
  manager.setOnlineFontProviders({ google: true })
  const family = 'Fonts Test Shared Coverage'
  const fontURL = 'https://fonts.gstatic.com/s/test/shared.ttf'
  const variable = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  const asked: string[] = []
  manager.setWebFontFetch(async (url) => {
    if (url.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({
        familyMetadataList: [
          { family, fonts: { '400': {}, '700': {} }, axes: [{ tag: 'wght', min: 100, max: 900 }] }
        ]
      })
    if (url.startsWith('https://fonts.googleapis.com/css2')) {
      asked.push(new URL(url).searchParams.get('text') ?? '')
      return new Response(
        `@font-face { font-family: '${family}'; font-style: normal; font-weight: 100 900; src: url(${fontURL}) format('truetype'); }`
      )
    }
    if (url === fontURL) return new Response(variable.slice(0))
    return new Response(null, { status: 404 })
  })

  await manager.loadFont(family, 'Regular', 'abc')
  await manager.loadFont(family, 'Bold', 'xyz')
  expect(asked.at(-1)).toContain('xyz')
})

test('keeps the file it has when the same font is read or downloaded again', async () => {
  const manager = offlineManager()
  const family = 'Fonts Test Same File'
  const file = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await manager.markLoaded(family, 'Regular', file)
  await manager.markLoaded(family, 'Regular', file.slice(0))
  expect(manager.loadedData(family, 'Regular')).toBe(file)
  // Nothing replaced the file, so it draws under the family's own name with nothing else.
  expect(manager.renderFamily(family, 'Regular')).toBe(family)
  expect(manager.renderShardFamilies(family, 'Regular')).toEqual([])
})
