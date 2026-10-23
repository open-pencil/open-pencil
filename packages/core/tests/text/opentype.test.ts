import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { fontManager } from '@open-pencil/core/text'

import { glyphAdvanceSync, glyphOutlineSourceSync } from '#core/text/opentype'

test('measures default advances whatever instance of a variable font was last outlined', async () => {
  const family = 'OpenType Test Variable'
  fontManager.markLoaded(
    family,
    'Regular',
    await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  )
  const source = glyphOutlineSourceSync(family, 'Regular', [{ axis: 'wght', value: 900 }])
  const glyph = source?.glyphOf('H') ?? 0
  const before = glyphAdvanceSync(family, 'Regular', glyph, 100)
  // opentype.js writes the instance's advance onto the glyph it outlines.
  source?.outline(glyph, 100)
  expect(glyphAdvanceSync(family, 'Regular', glyph, 100)).toBe(before)
})
