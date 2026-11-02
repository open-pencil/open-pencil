import { describe, expect, test } from 'bun:test'

import { guest, user } from '#cloud-tests/helpers/relay'
import { MAX_PRESENCE_NAME_LENGTH } from '#cloud/contract'
import { stampAwareness } from '#cloud/server'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

function presence(state: Record<string, unknown> | null) {
  const awareness = new awarenessProtocol.Awareness(new Y.Doc())
  awareness.setLocalState(state)
  return {
    awareness,
    update: awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID])
  }
}

function received(update: Uint8Array) {
  const awareness = new awarenessProtocol.Awareness(new Y.Doc())
  awarenessProtocol.applyAwarenessUpdate(awareness, update, 'remote')
  return awareness
}

describe('relay presence stamping', () => {
  test('replaces the claimed name with the verified one and adds the verified identity', () => {
    const source = presence({ user: { name: 'Mallory', color: '#f00' }, cursor: { x: 1 } })
    const stamped = stampAwareness(
      source.update,
      { principal: user('alice', 'Alice'), permission: 'view' },
      () => false
    )
    expect(stamped.claimed).toEqual([source.awareness.clientID])
    if (!stamped.update) throw new Error('Expected a forwarded update')
    expect(received(stamped.update).getStates().get(source.awareness.clientID)).toEqual({
      user: { name: 'Alice', color: '#f00' },
      cursor: { x: 1 },
      cloud: { kind: 'user', id: 'alice', name: 'Alice', permission: 'view' }
    })
  })

  test('cuts a long verified name to what peers accept, so the member still shows', () => {
    const long = `  ${'Bartholomew '.repeat(5)}  `
    const source = presence({ user: { name: 'x', color: '#f00' } })
    const stamped = stampAwareness(
      source.update,
      { principal: user('bart', long), permission: 'edit' },
      () => false
    )
    if (!stamped.update) throw new Error('Expected a forwarded update')
    const state = received(stamped.update).getStates().get(source.awareness.clientID)
    expect(state?.user).toEqual({
      name: long.trim().slice(0, MAX_PRESENCE_NAME_LENGTH),
      color: '#f00'
    })
  })

  test('never exposes a user email', () => {
    const source = presence({ user: { name: 'x' } })
    const stamped = stampAwareness(
      source.update,
      { principal: user('alice'), permission: 'edit' },
      () => false
    )
    if (!stamped.update) throw new Error('Expected a forwarded update')
    expect(new TextDecoder().decode(stamped.update)).not.toContain('@example.com')
  })

  test('drops entries for presence clients another peer owns', () => {
    const source = presence({ user: { name: 'Guest' } })
    const stamped = stampAwareness(
      source.update,
      { principal: guest('g1'), permission: 'view' },
      (clientId) => clientId === source.awareness.clientID
    )
    expect(stamped).toEqual({ update: null, claimed: [] })
  })

  test('drops malformed updates', () => {
    expect(
      stampAwareness(
        new Uint8Array([5, 1]),
        { principal: guest('g1'), permission: 'view' },
        () => false
      )
    ).toEqual({ update: null, claimed: [] })
  })
})
