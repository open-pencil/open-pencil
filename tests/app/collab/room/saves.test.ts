import { describe, expect, test } from 'bun:test'

import * as Y from 'yjs'

import { trackRoomSaves } from '@/app/collab/room/saves'

function peer() {
  const ydoc = new Y.Doc()
  const nodes = ydoc.getMap<unknown>('nodes')
  const saves = trackRoomSaves(ydoc, [nodes])
  return { ydoc, nodes, saves }
}

function exchange(from: Y.Doc, to: Y.Doc) {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)))
}

describe('room saves', () => {
  test('a peer’s own edits to the content are unsaved until a save holds them', () => {
    const { nodes, saves, ydoc } = peer()
    ydoc.getMap('meta').set('clock', 1)
    expect(saves.unsaved()).toBe(false)

    nodes.set('1:2', new Y.Map())
    expect(saves.unsaved()).toBe(true)
    saves.markSaved(saves.counts())
    expect(saves.unsaved()).toBe(false)
  })

  test('edits that arrive from another peer are theirs, and unsaved for everyone', () => {
    const ada = peer()
    const grace = peer()
    ada.nodes.set('1:2', new Y.Map())
    exchange(ada.ydoc, grace.ydoc)

    expect(grace.saves.counts()).toEqual(new Map([[String(ada.ydoc.clientID), 1]]))
    expect(grace.saves.unsaved()).toBe(true)
    grace.saves.markSaved(grace.saves.counts())
    exchange(grace.ydoc, ada.ydoc)
    expect(ada.saves.unsaved()).toBe(false)
  })

  test('a save that held fewer edits leaves the later ones unsaved', () => {
    const { nodes, saves } = peer()
    nodes.set('1:2', new Y.Map())
    const held = saves.counts()
    nodes.set('1:3', new Y.Map())

    saves.markSaved(held)
    expect(saves.unsaved()).toBe(true)
    saves.markSaved(saves.counts())
    saves.markSaved(held)
    expect(saves.unsaved()).toBe(false)
  })
})
