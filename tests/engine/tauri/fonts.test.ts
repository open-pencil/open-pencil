import { afterEach, describe, expect, test, vi } from 'bun:test'

import { fontManager } from '@open-pencil/core/text'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri-mocks'

class MockFontFace {
  family: string

  constructor(family: string) {
    this.family = family
  }

  async load() {
    return this
  }
}

function installFontFaceMocks() {
  const addedFaces: MockFontFace[] = []
  Object.assign(globalThis, {
    FontFace: MockFontFace,
    document: {
      fonts: {
        add(face: MockFontFace) {
          addedFaces.push(face)
        }
      }
    }
  })
  return addedFaces
}

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'FontFace')
})

describe('Tauri font helpers', () => {
  test('lists system font families through mocked Tauri IPC', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('list_system_fonts')
      return [{ family: 'System UI', styles: ['Regular', 'Bold'] }]
    })

    const { listFamilies, listFonts } = await import('@/app/editor/fonts')

    await expect(listFamilies()).resolves.toEqual(['System UI'])
    await expect(listFonts()).resolves.toEqual([
      { family: 'System UI', styles: ['Regular', 'Bold'] }
    ])
  })

  test('loads system font bytes and registers the face', async () => {
    const addedFaces = installFontFaceMocks()
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('load_system_font')
      expect(args).toEqual({ family: 'System UI', style: 'Bold Italic' })
      return [1, 2, 3, 4]
    })

    const { loadFont } = await import('@/app/editor/fonts')
    const buffer = await loadFont('System UI', 'Bold Italic')

    expect([...new Uint8Array(buffer ?? new ArrayBuffer(0))]).toEqual([1, 2, 3, 4])
    expect(fontManager.isLoaded('System UI', 'Bold Italic')).toBe(true)
    expect(addedFaces.map((face) => face.family)).toEqual(['System UI'])
  })

  test('falls back to font manager loading when the system font command fails', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('load_system_font')
      throw new Error('missing system font')
    })
    const fallback = new Uint8Array([9, 8, 7]).buffer
    const loadFontSpy = vi.spyOn(fontManager, 'loadFont').mockResolvedValue(fallback)

    const { loadFont } = await import('@/app/editor/fonts')

    await expect(loadFont('Missing Family', 'Regular')).resolves.toBe(fallback)
    expect(loadFontSpy).toHaveBeenCalledWith('Missing Family', 'Regular')
  })
})
