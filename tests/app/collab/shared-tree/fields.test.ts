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

  test('a malformed claim is ignored, and claiming the root records it', () => {
    const claims = meta()
    claims.set('root:shared:a', 'bogus')
    claims.set('root:owner:b', true)
    expect(readRoot(claims)).toBeUndefined()
    claimRoot(claims, 'a', 'shared')
    expect(readRoot(claims)).toBe('a')
  })

  test('one root claimed both ways at once keeps its shared claim after the merge', () => {
    // Yjs settles concurrent writes to one key by client id, so try both orders.
    for (const [leftId, rightId] of [
      [1, 2],
      [2, 1]
    ]) {
      const left = new Y.Doc()
      const right = new Y.Doc()
      left.clientID = leftId
      right.clientID = rightId
      claimRoot(left.getMap('meta'), 'z', 'shared')
      claimRoot(right.getMap('meta'), 'z', 'edited')
      claimRoot(right.getMap('meta'), 'a', 'edited')
      Y.applyUpdate(left, Y.encodeStateAsUpdate(right))
      Y.applyUpdate(right, Y.encodeStateAsUpdate(left))
      expect(readRoot(left.getMap('meta'))).toBe('z')
      expect(readRoot(right.getMap('meta'))).toBe('z')
    }
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
