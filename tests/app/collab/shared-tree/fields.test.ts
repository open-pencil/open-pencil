import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { claimRoot, readRoot } from '@/app/collab/shared-tree/fields'

function meta(): Y.Map<unknown> {
  return new Y.Doc().getMap('meta')
}

describe('collab room root', () => {
  test('the first claim sets the root and later claims leave it', () => {
    const claims = meta()
    expect(readRoot(claims)).toBeUndefined()
    claimRoot(claims, 'z')
    claimRoot(claims, 'a')
    expect(readRoot(claims)).toBe('z')
  })

  test('a malformed root is ignored and replaced by the next claim', () => {
    const claims = meta()
    claims.set('root', 7)
    expect(readRoot(claims)).toBeUndefined()
    claimRoot(claims, 'a')
    expect(readRoot(claims)).toBe('a')
  })
})
