import { afterEach, describe, expect, test, vi } from 'bun:test'

import { fontManager } from '@open-pencil/core/text'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
})

describe('Tauri font helpers', () => {
  test('lists system font families through mocked Tauri IPC', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('list_system_fonts')
      return [{ family: 'System UI', styles: ['Regular', 'Bold'] }]
    })

    vi.spyOn(fontManager, 'listFamilyOptions').mockResolvedValue([])
    const { listFamilies, listFonts } = await import('@/app/editor/fonts')

    await expect(listFamilies()).resolves.toEqual([{ family: 'System UI', source: 'local' }])
    await expect(listFonts()).resolves.toEqual([
      { family: 'System UI', styles: ['Regular', 'Bold'] }
    ])
  })

  test('loads system font bytes and registers the face', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('load_system_font')
      expect(args).toEqual({ family: 'System UI', style: 'Bold Italic' })
      return new Uint8Array([1, 2, 3, 4]).buffer
    })

    const { loadFont } = await import('@/app/editor/fonts')
    const buffer = await loadFont('System UI', 'Bold Italic')

    expect([...new Uint8Array(buffer ?? new ArrayBuffer(0))]).toEqual([1, 2, 3, 4])
    expect(fontManager.isLoaded('System UI', 'Bold Italic')).toBe(true)
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
    expect(loadFontSpy).toHaveBeenCalledWith('Missing Family', 'Regular', '')
  })
})
