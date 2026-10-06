import { expect, test } from 'bun:test'

import { parseVariableId } from '../src/fig/variable-bindings'

test('parses Figma variable IDs', () => {
  expect(parseVariableId('VariableID:123:456')).toEqual({ sessionID: 123, localID: 456 })
  expect(parseVariableId('not-a-variable')).toBeNull()
})
