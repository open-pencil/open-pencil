import { describe, expect, test } from 'bun:test'

import { electCloudSaver } from '@/app/cloud/rooms/live'

const editor = { cloud: { permission: 'edit' } }
const viewer = { cloud: { permission: 'view' } }

describe('the room saver', () => {
  test('is the editor with the lowest presence client, this tab included', () => {
    const presence = new Map<number, Record<string, unknown>>([
      [30, {}],
      [12, editor],
      [8, viewer]
    ])
    expect(electCloudSaver(presence, { clientId: 30, canEdit: true })).toBe(12)
    const withSelfFirst = new Map<number, Record<string, unknown>>([
      [5, {}],
      [12, editor]
    ])
    expect(electCloudSaver(withSelfFirst, { clientId: 5, canEdit: true })).toBe(5)
  })

  test('is never a viewer', () => {
    const presence = new Map<number, Record<string, unknown>>([
      [3, {}],
      [8, viewer]
    ])
    expect(electCloudSaver(presence, { clientId: 3, canEdit: false })).toBeNull()
  })
})
