import { describe, expect, test } from 'bun:test'

import { cjkFallbackFamiliesForScripts, FontManager } from '@open-pencil/core/text'

describe('CJK fallback ordering', () => {
  test('orders script-specific fallbacks before generic render fallbacks', async () => {
    const manager = new FontManager()
    manager.setFallbackUserAgent('X11; Linux x86_64')
    manager.setCJKFallbackFamily('Generic CJK')
    manager.loadFont = async (family: string) =>
      family === 'Noto Sans TC' || family === 'Noto Sans KR' ? new ArrayBuffer(12) : null

    await manager.ensureFallbackPack(['cjk-tc', 'cjk-kr'])

    expect(manager.getCJKFallbackFamilies()).toEqual([
      'Generic CJK',
      'Noto Sans TC',
      'Noto Sans KR'
    ])
    expect(cjkFallbackFamiliesForScripts(manager, ['cjk-tc', 'cjk-kr'])).toEqual([
      'Noto Sans TC',
      'Noto Sans KR',
      'Generic CJK'
    ])
  })

  test('keeps script-specific priority when generic fallback already contains that family', async () => {
    const manager = new FontManager()
    manager.setFallbackUserAgent('X11; Linux x86_64')
    manager.setCJKFallbackFamily('Noto Sans SC')
    manager.setCJKFallbackFamily('Noto Sans KR')
    manager.loadFont = async (family: string) =>
      family === 'Noto Sans KR' ? new ArrayBuffer(12) : null

    await manager.ensureFallbackPack(['cjk-kr'])

    expect(manager.getFallbackFamiliesForScript('cjk-kr')).toEqual(['Noto Sans KR', 'Noto Sans SC'])
    expect(cjkFallbackFamiliesForScripts(manager, ['cjk-kr'])).toEqual([
      'Noto Sans KR',
      'Noto Sans SC'
    ])
  })
})
