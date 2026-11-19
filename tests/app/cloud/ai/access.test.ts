import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { CLOUD_SERVICES_CONTRACT_VERSION } from '@open-pencil/cloud/contract'
import { fetchStub } from '@open-pencil/test-support/fetch'

import { cloudAIWorkspaces, firstCloudAIWorkspace } from '@/app/cloud/ai/access'
import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import { refreshCloudConnection } from '@/app/cloud/sessions/connection'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'

const ORIGIN = 'https://cloud.example.com'
const GONE = '0d6a4c1e-2b3f-4a5d-8e6f-7a8b9c0d1e2f'
const STUDIO = '6f1c2d3e-4f50-4d7e-9a52-0b6f4f9e3c1a'

function workspace(id: string, name: string) {
  const at = '2026-01-01T00:00:00.000Z'
  return { id, name, slug: name.toLowerCase(), role: 'editor', createdAt: at, updatedAt: at }
}

const entitlements = {
  features: {
    links: true,
    guestView: true,
    guestEdit: true,
    guestPresence: true,
    collaboration: true,
    revisionHistory: true,
    cloudServices: true
  },
  limits: {
    maximumFileBytes: 100_000_000,
    maximumStorageBytes: null,
    maximumParticipants: null,
    monthlyCreditAllowance: 1000
  },
  usage: { committedStorageBytes: 0, reservedStorageBytes: 0 }
}

/** What the server answers for the first workspace's entitlements. */
let goneAnswer: () => Response

beforeEach(() => {
  goneAnswer = () => Response.json({ error: { code: 'not_found' } }, { status: 404 })
  spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      switch (url.pathname) {
        case '/.well-known/openpencil':
          return Response.json({
            ...cloudDiscoveryFixture(ORIGIN),
            services: {
              endpoint: 'https://ai.example.com',
              contractVersion: CLOUD_SERVICES_CONTRACT_VERSION
            }
          })
        case '/api/account/status':
          return Response.json({
            user: { userId: 'user-1', email: 'ada@example.com', name: 'Ada' },
            state: 'active'
          })
        case '/api/workspaces':
          // The account left the first workspace after the editor listed it.
          return Response.json({
            workspaces: [workspace(GONE, 'Former'), workspace(STUDIO, 'Studio')]
          })
        case `/api/workspaces/${GONE}/entitlements`:
          return goneAnswer()
        case `/api/workspaces/${STUDIO}/entitlements`:
          return Response.json({ entitlements })
        default:
          return new Response(null, { status: 404 })
      }
    })
  )
})

afterEach(() => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
})

async function signIn() {
  const connection = await refreshCloudConnection(
    await addCloudServer({ kind: 'self-hosted', url: ORIGIN })
  )
  expect(connection.state).toBe('signed-in')
}

describe('Cloud AI workspaces', () => {
  test('skip a listed workspace the server no longer finds', async () => {
    await signIn()
    expect(await cloudAIWorkspaces()).toEqual([{ id: STUDIO, name: 'Studio' }])
    expect(await firstCloudAIWorkspace()).toEqual({ id: STUDIO, name: 'Studio' })
  })

  test('still fail when a workspace cannot be checked', async () => {
    goneAnswer = () => new Response('Internal Server Error', { status: 500 })
    await signIn()
    await expect(cloudAIWorkspaces()).rejects.toThrow()
    await expect(firstCloudAIWorkspace()).rejects.toThrow()
  })
})
