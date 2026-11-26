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
  test('knows deletions of what a gap left out from those of what it holds', () => {
    const state = roomStateFromSaved(null, [])
    const alice = client()
    const first = alice.edit((text) => text.insert(0, 'ab'))
    const second = alice.edit((text) => text.insert(2, 'cd'))
    // Only Alice's later edit reached the room, so it holds none of her text without a gap.
    state.add(second)
    const deletion = alice.edit((text) => text.delete(3, 1))
    expect(state.read(deletion)).toEqual({ adds: false, deletes: true })
    expect(state.deletesOnlyHeld(deletion)).toBe(false)
    // Once the gap is filled, the room holds everything the deletion names.
    state.add(first)
    expect(state.deletesOnlyHeld(deletion)).toBe(true)
  })

  test('turns away an update cut short before its deletions', () => {
    const state = roomStateFromSaved(null, [])
    const update = client().edit((text) => text.insert(0, 'hello'))
    expect(state.read(update)).toEqual({ adds: true, deletes: false })
    expect(state.read(update.subarray(0, -1))).toBeNull()
  })
})
