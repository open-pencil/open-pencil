import { describe, expect, test } from 'bun:test'

import { keepsRoom } from '@/app/cloud/rooms/live'

const joined = { roomId: 'cloud:doc:0', permission: 'edit' as const, readOnly: undefined }

describe('a refreshed ticket', () => {
  test('keeps the room while it grants what the tab joined with', () => {
    expect(keepsRoom(joined, { ...joined })).toBe(true)
  })

  test('ends the room once the document moved to another', () => {
    expect(keepsRoom(joined, { ...joined, roomId: 'cloud:doc:1' })).toBe(false)
  })

  test('ends the room once the owner fills or frees their storage', () => {
    const atLimit = { ...joined, permission: 'view' as const, readOnly: 'storage-limit' as const }
    expect(keepsRoom(joined, atLimit)).toBe(false)
    expect(keepsRoom(atLimit, joined)).toBe(false)
  })
})
