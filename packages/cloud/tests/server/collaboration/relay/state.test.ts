import { describe, expect, test } from 'bun:test'

import { roomStateFromSaved } from '#cloud/server/collaboration/relay/state'
import * as Y from 'yjs'

/** A client's document whose edits come out as separate V2 updates. */
function client() {
  const document = new Y.Doc()
  return {
    edit(change: (text: Y.Text) => void) {
      const before = Y.encodeStateVector(document)
      change(document.getText('t'))
      return Y.encodeStateAsUpdateV2(document, before)
    }
  }
}

describe('room state', () => {
  test('counts deletions of what a gap left out as additions', () => {
    const state = roomStateFromSaved(null, [])
    const alice = client()
    const first = alice.edit((text) => text.insert(0, 'ab'))
    const second = alice.edit((text) => text.insert(2, 'cd'))
    // Only Alice's later edit reached the room, so it holds none of her clocks without a gap.
    state.add(second)
    const deletion = alice.edit((text) => text.delete(0, 1))
    expect(state.read(deletion)).toEqual({ adds: true })
    // Once the gap is filled, deleting what the room holds adds nothing.
    state.add(first)
    const again = alice.edit((text) => text.delete(0, 1))
    expect(state.read(again)).toEqual({ adds: false })
  })
})
