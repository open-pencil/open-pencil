import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { corePackagePath, FIXTURES } from '#core-tests/helpers/paths'

import { fontManager } from '@open-pencil/core/text'

import {
  getGlyphOutlineMetricsSync,
  glyphAdvanceSync,
  glyphOutlineSourceSync
} from '#core/text/font/glyphs'

test('measures default advances whatever instance of a variable font was last outlined', async () => {
  const family = 'OpenType Test Variable'
  await fontManager.markLoaded(
    family,
    'Regular',
    await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  )
  const source = glyphOutlineSourceSync(family, 'Regular', [{ axis: 'wght', value: 900 }])
  const glyph = source?.glyphOf('H') ?? 0
  const before = glyphAdvanceSync(family, 'Regular', glyph, 100)
  // Outlining an instance must not change the default instance's advances.
  source?.outline(glyph, 100)
  expect(glyphAdvanceSync(family, 'Regular', glyph, 100)).toBe(before)
})

test('outlines a shaped mark where shaping places it on its base letter', async () => {
  const family = 'HarfBuzz Test Marks'
  await fontManager.markLoaded(
    family,
    'Regular',
    await Bun.file(corePackagePath('assets', 'InterVariable.ttf')).arrayBuffer()
  )
  const [base, mark] = getGlyphOutlineMetricsSync(family, 'Regular', 'q́', 100) ?? []
  const xs = (mark?.commands ?? []).flatMap((command) => (command.x === undefined ? [] : [command.x]))
  expect(xs.length).toBeGreaterThan(0)
  // The acute's pen is past the q; its outline reaches back over the q.
  expect(mark?.x).toBe(base?.advance)
  expect(Math.max(...xs)).toBeLessThan(0)
})
