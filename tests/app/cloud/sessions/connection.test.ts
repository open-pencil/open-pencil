import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { addCloudServer, cloudServers, removeCloudServer } from '@/app/cloud/servers/store'
import {
  checkedCloudConnection,
  cloudConnection,
  recheckedCloudConnection,
  refreshCloudConnection
} from '@/app/cloud/sessions/connection'
import { readCloudSessionToken, saveCloudSessionToken } from '@/app/cloud/sessions/token'

import { cloudDiscoveryFixture } from '#tests/helpers/cloud/discovery'
import { fetchStub } from '#tests/helpers/fetch'

const ORIGIN = 'https://cloud.example.com'
const user = { userId: 'user-1', email: 'ada@example.com', name: 'Ada' }
const workspace = {
  id: '6f1c6c1e-7a4d-4d1b-9a2e-1f0b6a3c2d10',
  name: 'Design',
  slug: 'design',
  role: 'editor',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

type Answer = { status: number; body?: unknown }
let answers: Record<string, Answer> = {}
let authorization: (string | null)[] = []
let statusRequests = 0

beforeEach(() => {
  answers = {}
  authorization = []
  statusRequests = 0
  spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      authorization.push(new Headers(init?.headers).get('Authorization'))
      if (url.pathname === '/api/account/status') statusRequests += 1
      if (url.pathname === '/.well-known/openpencil')
        return Response.json(cloudDiscoveryFixture(ORIGIN))
      const answer = answers[url.pathname]
      if (!answer) return new Response(null, { status: 404 })
      return Response.json(answer.body ?? { error: { code: 'unauthorized' } }, {
        status: answer.status
      })
    })
  )
})

afterEach(() => {
  for (const server of cloudServers.value) removeCloudServer(server.id)
})

async function server() {
  return addCloudServer({ kind: 'self-hosted', url: ORIGIN })
}

describe('Cloud connections', () => {
  test('list workspaces for an approved account and remember who it is', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    const connection = await refreshCloudConnection(target)
    expect(connection.state).toBe('signed-in')
    expect(connection.workspaces.map((entry) => entry.name)).toEqual(['Design'])
    expect(cloudServers.value[0]?.account).toEqual({
      id: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      image: null
    })
  })

  test('tell an account waiting for an administrator from one signed out', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'pending' } }
    expect((await refreshCloudConnection(await server())).state).toBe('pending')
  })

  test('send the device-code token and drop it once the server stops accepting it', async () => {
    const target = await server()
    await saveCloudSessionToken(target.id, 'device-token')
    answers['/api/account/status'] = { status: 401 }
    const connection = await refreshCloudConnection(target)
    expect(authorization).toContain('Bearer device-token')
    expect(connection.state).toBe('signed-out')
    expect(await readCloudSessionToken(target.id)).toBeNull()
  })

  test('call a remembered account whose session ended expired', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [] } }
    const target = await server()
    await refreshCloudConnection(target)
    answers['/api/account/status'] = { status: 401 }
    const remembered = cloudServers.value[0]
    if (!remembered) throw new Error('Expected the server to be saved')
    expect((await refreshCloudConnection(remembered)).state).toBe('expired')
    expect(cloudConnection(target.id).account?.email).toBe('ada@example.com')
  })

  test('wait for the check under way instead of starting one that throws its answer away', async () => {
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    const target = await server()
    const starting = refreshCloudConnection(target)
    const waiting = checkedCloudConnection(target)
    await starting
    expect(cloudConnection(target.id).state).toBe('signed-in')
    expect((await waiting).state).toBe('signed-in')
    // One account status and one workspace list: the server was asked once.
    expect(authorization).toHaveLength(2)
  })

  test('ask a server out of reach again rather than keep its old answer', async () => {
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    const target = await server()
    expect((await refreshCloudConnection(target)).state).toBe('unreachable')
    answers['/api/account/status'] = { status: 200, body: { user, state: 'active' } }
    answers['/api/workspaces'] = { status: 200, body: { workspaces: [workspace] } }
    expect((await recheckedCloudConnection(target)).state).toBe('signed-in')
  })

  test('take the answer of the check under way without asking twice', async () => {
    answers['/api/account/status'] = { status: 503, body: { error: { code: 'unavailable' } } }
    const target = await server()
    const starting = refreshCloudConnection(target)
    const waiting = recheckedCloudConnection(target)
    await starting
    expect((await waiting).state).toBe('unreachable')
    expect(statusRequests).toBe(1)
  })
})
