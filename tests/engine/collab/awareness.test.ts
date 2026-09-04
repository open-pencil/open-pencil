import { describe, expect, test } from 'bun:test'

import type { CollaborationPrincipal } from '@open-pencil/cloud/contract'

import { buildRemotePeers } from '@/app/collab/awareness'

const color = { r: 0.2, g: 0.4, b: 0.6, a: 1 }

describe('collaboration awareness identity', () => {
  test('exposes signed Cloud identity and permission in remote presence', () => {
    const principal: CollaborationPrincipal = {
      kind: 'user',
      userId: 'user-1',
      name: 'Signed-in editor',
      email: 'editor@example.com'
    }
    const peers = buildRemotePeers(
      new Map([
        [
          2,
          {
            user: {
              name: principal.name,
              color,
              identity: {
                source: 'cloud',
                principal,
                permission: 'edit',
                serverEnforcedWrites: false
              }
            }
          }
        ]
      ]),
      1
    )

    expect(peers[0]).toMatchObject({
      name: 'Signed-in editor',
      identity: {
        source: 'cloud',
        principal: { kind: 'user', userId: 'user-1' },
        permission: 'edit',
        serverEnforcedWrites: false
      }
    })
  })

  test('marks legacy temporary-room peers as local identities', () => {
    const peers = buildRemotePeers(new Map([[2, { user: { name: 'Local guest', color } }]]), 1)
    expect(peers[0]?.identity).toEqual({
      source: 'local',
      principal: null,
      permission: null,
      serverEnforcedWrites: false
    })
  })
})
