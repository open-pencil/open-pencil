import { describe, expect, test } from 'bun:test'

import { electCloudSaver } from '@/app/cloud/rooms/live'

const editor = { cloud: { kind: 'user', permission: 'edit' } }
const viewer = { cloud: { kind: 'user', permission: 'view' } }
const guest = { cloud: { kind: 'guest', permission: 'edit' } }

describe('the room saver', () => {
  test('is the editor with the lowest presence client, this tab included', () => {
    const presence = new Map<number, Record<string, unknown>>([
      [30, {}],
      [12, editor],
      [8, viewer]
    ])
    expect(electCloudSaver(presence, { clientId: 30, canSave: true })).toBe(12)
    const withSelfFirst = new Map<number, Record<string, unknown>>([
      [5, {}],
      [12, editor]
    ])
    expect(electCloudSaver(withSelfFirst, { clientId: 5, canSave: true })).toBe(5)
  })

  test('is never a guest from a link, who has no account to save with', () => {
    const presence = new Map<number, Record<string, unknown>>([
      [2, guest],
      [9, {}]
    ])
    expect(electCloudSaver(presence, { clientId: 9, canSave: true })).toBe(9)
  })

  test('is never a viewer', () => {
    const presence = new Map<number, Record<string, unknown>>([
      [3, {}],
      [8, viewer]
    ])
    expect(electCloudSaver(presence, { clientId: 3, canSave: false })).toBeNull()
  })
})
