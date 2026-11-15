import { describe, expect, test } from 'bun:test'

import { assignVariableGuid } from '#core/io/formats/fig/export/variables'

describe('variable GUIDs in a saved .fig', () => {
  test('keep an ID that spells one Figma reads, and replace one Figma would drop', () => {
    const assign = (id: string) => assignVariableGuid(id, { value: 7 }, new Set(), new Set())
    expect(assign('12:34')).toEqual({ sessionID: 12, localID: 34 })
    // Figma drops a record whose GUID parts reach 2^31.
    expect(assign('2147483648:1')).toEqual({ sessionID: 0, localID: 7 })
  })
})
