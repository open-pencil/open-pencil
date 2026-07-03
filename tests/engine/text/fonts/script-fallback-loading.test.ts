import { describe, expect, test } from 'bun:test'

import { FontManager } from '@open-pencil/core/text'

describe('script-specific fallback loading', () => {
  test('loads script-specific CJK fallback after generic fallback has loaded', async () => {
    const manager = new FontManager()
    const requestedFamilies: string[] = []
    manager.setFallbackUserAgent('X11; Linux x86_64')
    manager.setCJKFallbackFamily('Generic CJK')
    manager.loadFont = async (family: string) => {
      requestedFamilies.push(family)
      return family === 'Noto Sans KR' ? new ArrayBuffer(12) : null
    }

    const korean = await manager.ensureFallbackPack(['cjk-kr'])

    expect(korean['cjk-kr']).toContain('Noto Sans KR')
    expect(requestedFamilies).toContain('Noto Sans KR')
    expect(manager.hasFallbackForScript('cjk-kr')).toBe(true)
    expect(manager.getFallbackFamiliesForScript('cjk-kr')).toEqual(['Noto Sans KR', 'Generic CJK'])
  })

  test('does not satisfy Korean fallback pack with Simplified Chinese local fallback', async () => {
    const manager = new FontManager()
    const requestedFamilies: string[] = []
    manager.setFallbackUserAgent('X11; Linux x86_64')
    manager.setHostFallbackFontLoader(async (family) => {
      requestedFamilies.push(family)
      return family === 'Noto Sans CJK SC' ? new ArrayBuffer(12) : null
    })
    manager.loadFont = async (family: string) => {
      requestedFamilies.push(family)
      return null
    }

    const korean = await manager.ensureFallbackPack(['cjk-kr'])

    expect(korean['cjk-kr']).toEqual([])
    expect(requestedFamilies).toContain('Noto Sans CJK KR')
    expect(requestedFamilies).toContain('Noto Sans KR')
    expect(requestedFamilies).not.toContain('Noto Sans CJK SC')
    expect(requestedFamilies).not.toContain('Noto Sans SC')
    expect(manager.hasFallbackForScript('cjk-kr')).toBe(false)
  })
})
