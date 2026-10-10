import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import {
  acceptCloudInvitation,
  beginCloudInvitation,
  checkCloudInvitation,
  cloudInvitation,
  cloudInvitationState,
  dismissCloudInvitation
} from '@/app/cloud/invitations/flow'
import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import { refreshCloudConnection } from '@/app/cloud/sessions/connection'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
import { fetchStub } from '#tests/helpers/fetch'

const ORIGIN = 'https://invite.example.com'
const INVITATION = '6f1c6c1e-7a4d-4d1b-9a2e-1f0b6a3c2d11'
let answers: Record<string, { status: number; body?: unknown }> = {}

beforeEach(() => {
  answers = {
    [`/api/invitations/${INVITATION}/preview`]: {
      status: 200,
      body: {
        invitation: {
          documentName: 'Pricing page',
          inviterName: 'Ana',
          permission: 'edit',
          expiresAt: '2030-01-01T00:00:00.000Z',
          recipientHint: 'b•••@example.com'
        }
      }
    }
  }
  spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.pathname === '/.well-known/openpencil')
        return Response.json(cloudDiscoveryFixture(ORIGIN))
      const answer = answers[url.pathname]
      if (!answer) return Response.json({ error: { code: 'not_found' } }, { status: 404 })
      return Response.json(answer.body ?? {}, { status: answer.status })
    })
  )
})

afterEach(() => {
  dismissCloudInvitation()
  for (const server of cloudServers.value) removeCloudServer(server.id)
})

async function signedIn() {
  answers['/api/account/status'] = {
    status: 200,
    body: { user: { userId: 'user-1', email: 'ben@example.com', name: 'Ben' }, state: 'active' }
  }
  answers['/api/workspaces'] = { status: 200, body: { workspaces: [] } }
  await refreshCloudConnection(await addCloudServer({ kind: 'self-hosted', url: ORIGIN }))
}

describe('Cloud invitations', () => {
  test('ask to sign in to a server this app has never used, and warn about it', async () => {
    beginCloudInvitation(INVITATION, ORIGIN, 'token'.repeat(8))
    await checkCloudInvitation()
    expect(cloudInvitationState.value).toBe('sign-in')
    expect(cloudInvitation.value).toMatchObject({
      documentName: 'Pricing page',
      unknownServer: true
    })
  })

  test('are ready to accept once signed in to their server', async () => {
    await signedIn()
    beginCloudInvitation(INVITATION, ORIGIN, 'token'.repeat(8))
    await checkCloudInvitation()
    expect(cloudInvitationState.value).toBe('ready')
    expect(cloudInvitation.value?.unknownServer).toBe(false)
  })

  test('call an invitation the server refuses right after a valid preview another account’s', async () => {
    await signedIn()
    beginCloudInvitation(INVITATION, ORIGIN, 'token'.repeat(8))
    await checkCloudInvitation()
    await acceptCloudInvitation()
    expect(cloudInvitationState.value).toBe('wrong-account')
  })

  test('are unavailable when the preview is refused', async () => {
    delete answers[`/api/invitations/${INVITATION}/preview`]
    beginCloudInvitation(INVITATION, ORIGIN, 'token'.repeat(8))
    await checkCloudInvitation()
    expect(cloudInvitationState.value).toBe('unavailable')
  })
})
