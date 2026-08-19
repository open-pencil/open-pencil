import { describe, expect, test } from 'bun:test'

import { SignJWT } from 'jose'

import {
  authorizeCollaborationRelay,
  collaborationProviderOptions
} from '@open-pencil/cloud/server'

const authSecret = 'relay-auth-secret-at-least-32-characters'
const documentId = '11111111-1111-4111-8111-111111111111'

async function ticket(permission: 'view' | 'edit', roomEpoch = 2) {
  const roomId = `cloud:${documentId}:${roomEpoch}`
  return new SignJWT({
    documentId,
    roomId,
    principal: { kind: 'guest', guestId: 'relay-test-guest', name: 'Relay Guest' },
    permission,
    roomEpoch,
    serverEnforcedWrites: true
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(authSecret))
}

describe('Cloud collaboration relay', () => {
  test('authorizes editor and viewer tickets with server-enforced readonly state', async () => {
    const roomId = `cloud:${documentId}:2`
    expect(
      await authorizeCollaborationRelay(await ticket('view'), roomId, authSecret)
    ).toMatchObject({
      documentId,
      roomId,
      permission: 'view',
      principal: { kind: 'guest', guestId: 'relay-test-guest', name: 'Relay Guest' },
      readOnly: true
    })
    expect(
      await authorizeCollaborationRelay(await ticket('edit'), roomId, authSecret)
    ).toMatchObject({ permission: 'edit', readOnly: false })
  })

  test('rejects tickets for another room', async () => {
    await expect(
      authorizeCollaborationRelay(await ticket('edit'), `cloud:${documentId}:3`, authSecret)
    ).rejects.toThrow('not valid for this room')
  })

  test('maps Hocuspocus tickets to provider options and ignores Trystero tickets', () => {
    expect(
      collaborationProviderOptions({
        provider: 'hocuspocus',
        serverURL: 'wss://cloud.example.com/collaboration',
        token: 'signed-ticket',
        documentId,
        roomId: `cloud:${documentId}:2`,
        roomKey: 'r'.repeat(43),
        principal: { kind: 'guest', guestId: 'stable-guest-id', name: 'Guest' },
        permission: 'view',
        roomEpoch: 2,
        expiresAt: '2026-01-01T00:00:00.000Z',
        serverEnforcedWrites: true
      })
    ).toEqual({
      url: 'wss://cloud.example.com/collaboration',
      name: `cloud:${documentId}:2`,
      token: 'signed-ticket'
    })
  })
})
