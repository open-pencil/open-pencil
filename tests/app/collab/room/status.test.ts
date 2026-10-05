import { describe, expect, test } from 'bun:test'

import { deriveRoomStatus } from '@/app/collab/room/status'

const base = { hasDocument: false, savedCopyLoaded: false, waitedLong: false, peerCount: 0 }

describe('room tab status', () => {
  test('joins until the saved copy loads and the grace period passes', () => {
    expect(deriveRoomStatus(base)).toBe('joining')
    expect(deriveRoomStatus({ ...base, savedCopyLoaded: true })).toBe('joining')
    expect(deriveRoomStatus({ ...base, waitedLong: true })).toBe('joining')
  })

  test('waits when nobody online has the document, even if someone else is waiting too', () => {
    const waited = { ...base, savedCopyLoaded: true, waitedLong: true }
    expect(deriveRoomStatus(waited)).toBe('waiting')
    expect(deriveRoomStatus({ ...waited, peerCount: 1 })).toBe('waiting')
  })

  test('shows the document live with others, and alone from the saved copy', () => {
    expect(deriveRoomStatus({ ...base, hasDocument: true, peerCount: 2 })).toBe('live')
    expect(deriveRoomStatus({ ...base, hasDocument: true, savedCopyLoaded: true })).toBe('alone')
  })
})
