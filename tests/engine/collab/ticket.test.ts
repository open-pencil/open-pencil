import { describe, expect, test } from 'bun:test'

import type { CollaborationTicket } from '@open-pencil/cloud/contract'

import {
  collaborationTicketRefreshDelay,
  requireActiveCollaborationTicket,
  sameCollaborationRoom
} from '@/app/collab/ticket'

function ticket(overrides: Partial<CollaborationTicket> = {}): CollaborationTicket {
  return {
    token: 'signed-token',
    documentId: '11111111-1111-4111-8111-111111111111',
    roomId: 'cloud:document:0',
    roomKey: 'r'.repeat(43),
    principal: {
      kind: 'user',
      userId: 'user-1',
      name: 'Cloud user',
      email: 'user@example.com'
    },
    permission: 'edit',
    roomEpoch: 0,
    expiresAt: new Date(120_000).toISOString(),
    serverEnforcedWrites: false,
    ...overrides
  }
}

describe('Cloud collaboration tickets', () => {
  test('rejects expired tickets before joining a room', () => {
    expect(() =>
      requireActiveCollaborationTicket(ticket({ expiresAt: new Date(999).toISOString() }), 1_000)
    ).toThrow('expired')
  })

  test('refreshes thirty seconds before expiry', () => {
    expect(collaborationTicketRefreshDelay(ticket(), 10_000)).toBe(80_000)
  })

  test('treats room epochs and permissions as connection identity', () => {
    const current = ticket()
    expect(sameCollaborationRoom(current, ticket())).toBe(true)
    expect(sameCollaborationRoom(current, ticket({ roomEpoch: 1 }))).toBe(false)
    expect(sameCollaborationRoom(current, ticket({ permission: 'view' }))).toBe(false)
  })

  test('retains stable guest identity across refreshed tickets', () => {
    const principal = { kind: 'guest' as const, guestId: 'guest-device-id', name: 'Guest designer' }
    expect(sameCollaborationRoom(ticket({ principal }), ticket({ principal }))).toBe(true)
    expect(
      sameCollaborationRoom(
        ticket({ principal }),
        ticket({ principal: { ...principal, guestId: 'other' } })
      )
    ).toBe(false)
  })
})
