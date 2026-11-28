import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { corePackagePath } from '#core-tests/helpers/paths'

import { fontFaceName, fontLegacyFaceName } from '#core/text/font/variation'

function asset(name: string): ArrayBuffer {
  return Uint8Array.from(readFileSync(corePackagePath('assets', name))).buffer
}

describe('fontLegacyFaceName', () => {
  test('reads the legacy family a face beyond regular and bold names apart', () => {
    const semiBold = asset('Inter-SemiBold.ttf')
    expect(fontFaceName(semiBold)).toEqual({ family: 'Inter', style: 'SemiBold' })
    expect(fontLegacyFaceName(semiBold)).toEqual({ family: 'Inter SemiBold', style: 'Regular' })
  })

  test('reads the same names as the typographic ones for a regular face', () => {
    expect(fontLegacyFaceName(asset('NotoNaskhArabic-Regular.ttf'))).toEqual({
      family: 'Noto Naskh Arabic',
      style: 'Regular'
    })
  })

  test('reads nothing from data without a name table', () => {
    expect(fontLegacyFaceName(new ArrayBuffer(12))).toBeNull()
  })
})
