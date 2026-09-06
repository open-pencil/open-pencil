import { expect, test } from 'bun:test'

import { createResourceResolver } from '#fig/document/resource-reference'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('resolves exact resource versions and refuses ambiguous unversioned references', () => {
  const resolve = createResourceResolver([
    { guid: { sessionID: 1, localID: 1 }, key: 'collection', version: 'v1' },
    { guid: { sessionID: 1, localID: 2 }, key: 'collection', version: 'v2' }
  ] as NodeChange[])
  expect(resolve({ assetRef: { key: 'collection', version: 'v2' } })).toBe('1:2')
  expect(resolve({ assetRef: { key: 'collection', version: 'missing' } })).toBeUndefined()
  expect(resolve({ assetRef: { key: 'collection' } })).toBeUndefined()
  expect(resolve({ guid: { sessionID: 2, localID: 3 } })).toBe('2:3')
})
