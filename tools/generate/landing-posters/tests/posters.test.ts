import { describe, expect, test } from 'bun:test'

import { FEATURE_KINDS } from '#docs-config/theme/landing/content/features'
import { posterParts, posterPath } from '#docs-config/theme/landing/posters'

const TARGET = {
  fingerprint: '0123456789abcdef',
  locale: 'ru',
  theme: 'dark',
  layout: 'phone'
} as const

describe('landing poster paths', () => {
  test('name the fingerprint, locale, theme, layout, stage, and part', () => {
    expect(posterPath(TARGET, 'design', 'panel')).toBe(
      'landing-posters/0123456789abcdef/ru/dark-phone/design-panel.webp'
    )
  })

  test('split single-editor stages into canvas and panel, and keep collaboration whole', () => {
    for (const kind of FEATURE_KINDS) {
      expect(posterParts(kind)).toEqual(kind === 'collab' ? ['frame'] : ['canvas', 'panel'])
    }
  })

  test('are unique across every stage and part of a page', () => {
    const paths = FEATURE_KINDS.flatMap((kind) =>
      posterParts(kind).map((part) => posterPath(TARGET, kind, part))
    )
    expect(new Set(paths).size).toBe(paths.length)
  })
})
