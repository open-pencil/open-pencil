import { expect, test } from 'bun:test'

import { parseGuidOrNull } from '#fig/node-change/export/context'

// Figma (desktop 126) drops a pasted layer whose GUID part is past a signed 32-bit integer, and
// gives component properties ids that use all 32 bits, such as the shadcn/ui kit's 2583624281:….
test('a GUID part past 31 bits names a component property but not a layer', () => {
  expect(parseGuidOrNull('12:34')).toEqual({ sessionID: 12, localID: 34 })
  expect(parseGuidOrNull('2583624281:1250876564')).toBeNull()
  expect(parseGuidOrNull('2583624281:1250876564', { wholeParts: true })).toEqual({
    sessionID: 2583624281,
    localID: 1250876564
  })
  // Past 32 bits, the unset GUID, and anything not spelled as one are never GUIDs.
  for (const value of ['4294967296:1', '4294967295:4294967295', 'prop:abc', '1:2:3'])
    expect([value, parseGuidOrNull(value, { wholeParts: true })]).toEqual([value, null])
})
