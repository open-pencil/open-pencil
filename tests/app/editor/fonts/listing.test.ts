import { describe, expect, test } from 'bun:test'

import type { FamilyFace } from '@open-pencil/core/text'

import { availableFonts } from '@/app/editor/fonts'

function names(fonts: ReturnType<typeof availableFonts>): string[] {
  return fonts.map(({ fontName }) => `${fontName.family}/${fontName.style}`)
}

const extraBold: FamilyFace = { weight: 800, italic: false, style: 'Extra Bold' }
const semiBold: FamilyFace = { weight: 600, italic: false, style: 'Semi Bold' }

describe('availableFonts', () => {
  test('lists the faces a web family is known to have under their own names', () => {
    const fonts = availableFonts(
      [],
      [{ family: 'Plus Jakarta Sans', source: 'google' }],
      (family) => (family === 'Plus Jakarta Sans' ? [semiBold, extraBold] : null)
    )
    expect(names(fonts)).toEqual(['Plus Jakarta Sans/Semi Bold', 'Plus Jakarta Sans/Extra Bold'])
  })

  test('lists a family whose faces are not known yet as Regular', () => {
    const fonts = availableFonts([], [{ family: 'Unlooked', source: 'google' }], () => null)
    expect(names(fonts)).toEqual(['Unlooked/Regular'])
  })

  test('lists an installed family once, with its installed faces', () => {
    const fonts = availableFonts(
      [{ family: 'Installed', faces: [{ style: 'Book', weight: 350, italic: false }] }],
      [{ family: 'Installed', source: 'local' }],
      () => [extraBold]
    )
    expect(names(fonts)).toEqual(['Installed/Book'])
  })

  test('lists every face of a bundled family by default', () => {
    const styles = availableFonts([], [{ family: 'Inter', source: 'bundled' }])
      .filter(({ fontName }) => fontName.family === 'Inter')
      .map(({ fontName }) => fontName.style)
    expect(styles.length).toBeGreaterThan(1)
    expect(styles).toContain('Regular')
    expect(styles).toContain('Bold')
  })
})
