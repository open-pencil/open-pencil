import { describe, expect, test } from 'bun:test'

import { MAX_AGENTS_PER_PEER, parsePeer } from '@/app/presence/schema'

const user = { name: 'Ana', color: { r: 1, g: 0, b: 0, a: 1 } }
const agent = {
  id: 'a1',
  name: 'Fern',
  kind: 'chat',
  status: 'editing',
  cursor: { x: 10, y: 20, pageId: '0:1' }
}

describe('parsePeer', () => {
  test('reads a person with their agents', () => {
    expect(
      parsePeer(7, { user, cursor: { x: 1, y: 2, pageId: '0:1' }, agents: [agent] })
    ).toMatchObject({
      clientId: 7,
      name: 'Ana',
      cursor: { x: 1, y: 2, pageId: '0:1' },
      agents: [{ name: 'Fern', status: 'editing', cursor: { x: 10, y: 20 } }]
    })
  })

  test('ignores a state without a user', () => {
    expect(parsePeer(7, { cursor: { x: 1, y: 2, pageId: '0:1' } })).toBeNull()
  })

  test('drops invalid fields instead of the whole peer', () => {
    const peer = parsePeer(7, {
      user: { name: 'Ana', color: 'red' },
      cursor: { x: Number.NaN, y: 2, pageId: '0:1' },
      selection: 'everything',
      agents: [agent, { ...agent, id: 'a2', kind: 'unknown' }, 42]
    })
    expect(peer).toMatchObject({ name: 'Ana', cursor: undefined, selection: undefined })
    expect(peer?.agents.map((entry) => entry.id)).toEqual(['a1'])
  })

  test('bounds names and agent counts', () => {
    const tooMany = Array.from({ length: MAX_AGENTS_PER_PEER + 1 }, (_, i) => ({
      ...agent,
      id: `a${i}`
    }))
    expect(parsePeer(7, { user, agents: tooMany })?.agents).toEqual([])
    expect(parsePeer(7, { user: { name: 'x'.repeat(200) } })?.name).toBe('Anonymous')
  })

  test('reads the layer tree format a peer syncs, and ignores a malformed one', () => {
    expect(parsePeer(7, { user, treeFormat: 2 })?.treeFormat).toBe(2)
    expect(parsePeer(7, { user, treeFormat: 'two' })).toMatchObject({
      name: 'Ana',
      treeFormat: undefined
    })
    expect(parsePeer(7, { user })?.treeFormat).toBeUndefined()
  })
})
