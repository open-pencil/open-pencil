import { describe, expect, test } from 'bun:test'

import { guidToString, stringToGuid } from '../src/fig/guid'

describe('Figma GUID helpers', () => {
  test('formats GUID structs as Figma IDs', () => {
    expect(guidToString({ sessionID: 12, localID: 34 })).toBe('12:34')
  })

  test('parses plain Figma IDs', () => {
    expect(stringToGuid('12:34')).toEqual({ sessionID: 12, localID: 34 })
  })

  test('parses variable-prefixed Figma IDs', () => {
    expect(stringToGuid('VariableID:12:34')).toEqual({ sessionID: 12, localID: 34 })
    expect(stringToGuid('VariableCollectionId:56:78')).toEqual({
      sessionID: 56,
      localID: 78
    })
  })
})
