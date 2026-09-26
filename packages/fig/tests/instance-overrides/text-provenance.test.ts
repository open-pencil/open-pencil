import { expect, test } from 'bun:test'

import { invalidateInheritedTextData } from '#fig/instance-overrides/text-provenance'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

for (const patch of [
  { fontSize: 20 },
  { fontName: { family: 'Other', style: 'Regular' } },
  { styleIdForText: { guid: { sessionID: 1, localID: 2 } } },
  { textData: { characters: 'Same', characterStyleIDs: [1] } }
]) {
  test(`invalidates inherited glyphs for ${Object.keys(patch)[0]} changes`, () => {
    const source: NodeChange = {
      textData: { characters: 'Same' },
      fontSize: 14,
      derivedTextData: { layoutSize: { x: 40, y: 20 } }
    }
    invalidateInheritedTextData(source, patch)
    expect(source.derivedTextData).toBeUndefined()
  })
}
test('preserves caches for identical shaping, paint-only patches and explicit replacement data', () => {
  const source: NodeChange = {
    textData: { characters: 'Same' },
    fontSize: 14,
    derivedTextData: { layoutSize: { x: 40, y: 20 } }
  }
  for (const patch of [
    { fontSize: 14 },
    { fillPaints: [] },
    { textData: { characters: 'Other' }, derivedTextData: { layoutSize: { x: 80, y: 20 } } }
  ]) {
    invalidateInheritedTextData(source, patch)
    expect(source.derivedTextData?.layoutSize).toEqual({ x: 40, y: 20 })
  }
})
