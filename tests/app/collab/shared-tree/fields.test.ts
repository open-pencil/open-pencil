import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { claimRoot, readRoot } from '@/app/collab/shared-tree/fields'

function meta(): Y.Map<unknown> {
  return new Y.Doc().getMap('meta')
}

describe('collab room root claims', () => {
  test('a shared root outranks a root claimed by an edit, whatever their ids', () => {
    const claims = meta()
    claimRoot(claims, 'a', 'edited')
    claimRoot(claims, 'z', 'shared')
    expect(readRoot(claims)).toBe('z')
  })

  test('claims of one kind fall back to the lower id', () => {
    const claims = meta()
    claimRoot(claims, 'z', 'edited')
    claimRoot(claims, 'a', 'edited')
    expect(readRoot(claims)).toBe('a')
  })

  test('a claim replaces an invalid value and keeps a stronger one', () => {
    const claims = meta()
    claims.set('root:a', 'bogus')
    expect(readRoot(claims)).toBeUndefined()
    claimRoot(claims, 'a', 'shared')
    claimRoot(claims, 'a', 'edited')
    expect(claims.get('root:a')).toBe('shared')
    expect(readRoot(claims)).toBe('a')
  })

  test('concurrent claims from two documents both survive the merge', () => {
    const left = new Y.Doc()
    const right = new Y.Doc()
    claimRoot(left.getMap('meta'), 'z', 'shared')
    claimRoot(right.getMap('meta'), 'a', 'edited')
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right))
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left))
    expect(readRoot(left.getMap('meta'))).toBe('z')
    expect(readRoot(right.getMap('meta'))).toBe('z')
  })
})
