import { expect, test } from 'bun:test'

import { FontManager } from '@open-pencil/core/text'

/** A font manager that asks no web provider, so a family's faces come from its catalog. */
function offlineManager() {
  const manager = new FontManager()
  manager.setOnlineFontProviders({})
  return manager
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
  const next = new ArrayBuffer(16)
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
