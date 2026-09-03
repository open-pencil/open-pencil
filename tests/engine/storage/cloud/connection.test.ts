import { describe, expect, test } from 'bun:test'

import {
  createCloudConnectionService,
  normalizeCloudServerURL
} from '@/app/integrations/storage/cloud/connection'

const workspaceId = '11111111-1111-4111-8111-111111111111'

function discovery() {
  return {
    protocolVersion: '1',
    deployment: 'self-hosted',
    apiURL: 'https://cloud.example.com/api',
    authURL: 'https://cloud.example.com/api/auth',
    appURL: 'https://app.example.com',
    capabilities: { documents: true, workspaces: true, collaboration: false },
    authentication: { socialProviders: [], enterpriseSSO: false }
  }
}

function fetchMock() {
  let calls = 0
  return {
    calls: () => calls,
    async fetch(input: RequestInfo | URL) {
      calls++
      const url = String(input)
      if (url.includes('.well-known')) return Response.json(discovery())
      if (url.endsWith('/session')) {
        return Response.json({
          user: { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
        })
      }
      return Response.json({
        workspaces: [
          {
            id: workspaceId,
            name: 'Team',
            slug: 'team',
            role: 'admin',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      })
    }
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('Cloud connection service', () => {
  test('normalizes server identities', () => {
    expect(normalizeCloudServerURL(' https://cloud.example.com///?ignored=true#hash ')).toBe(
      'https://cloud.example.com'
    )
  })

  test('deduplicates concurrent connection requests and reuses discovery', async () => {
    const remote = fetchMock()
    const service = createCloudConnectionService({
      fetch: remote.fetch,
      readSelectedWorkspace: () => null,
      writeSelectedWorkspace: () => undefined
    })
    const [first, second] = await Promise.all([
      service.connect('https://cloud.example.com'),
      service.connect('https://cloud.example.com/')
    ])
    expect(first).toBe(second)
    expect(first.status).toBe('connected')
    expect(first.selectedWorkspaceId).toBe(workspaceId)
    expect(remote.calls()).toBe(3)

    await service.connect('https://cloud.example.com')
    expect(remote.calls()).toBe(3)

    await service.refresh('https://cloud.example.com')
    expect(remote.calls()).toBe(6)
  })

  test('ignores stale forced refreshes and disconnected requests', async () => {
    const firstSession = deferred<Response>()
    let sessionCalls = 0
    const service = createCloudConnectionService({
      async fetch(input) {
        const url = String(input)
        if (url.includes('.well-known')) return Response.json(discovery())
        if (url.endsWith('/session')) {
          sessionCalls++
          if (sessionCalls === 1) return firstSession.promise
          return Response.json({
            user: { userId: 'fresh', email: 'fresh@example.com', name: 'Fresh' }
          })
        }
        return Response.json({ workspaces: [] })
      },
      readSelectedWorkspace: () => null,
      writeSelectedWorkspace: () => undefined
    })
    const stale = service.connect('https://cloud.example.com')
    const fresh = await service.refresh('https://cloud.example.com')
    expect(fresh.status).toBe('connected')
    firstSession.resolve(
      Response.json({ user: { userId: 'stale', email: 'stale@example.com', name: 'Stale' } })
    )
    await stale
    expect(service.get('https://cloud.example.com')?.session?.user.userId).toBe('fresh')

    const disconnectedSession = deferred<Response>()
    const disconnected = createCloudConnectionService({
      async fetch(input) {
        const url = String(input)
        if (url.includes('.well-known')) return Response.json(discovery())
        if (url.endsWith('/session')) return disconnectedSession.promise
        return Response.json({ workspaces: [] })
      },
      readSelectedWorkspace: () => null,
      writeSelectedWorkspace: () => undefined
    })
    const request = disconnected.connect('https://cloud.example.com')
    disconnected.disconnect('https://cloud.example.com')
    disconnectedSession.resolve(
      Response.json({ user: { userId: 'done', email: 'done@example.com', name: 'Done' } })
    )
    await request
    expect(disconnected.get('https://cloud.example.com')).toBeNull()
  })

  test('clears only a rejected bearer token', async () => {
    const cleared: string[] = []
    const service = createCloudConnectionService({
      async fetch(input) {
        const url = String(input)
        if (url.includes('.well-known')) return Response.json(discovery())
        if (url.endsWith('/session'))
          return Response.json({ error: 'unauthorized' }, { status: 401 })
        return Response.json({ workspaces: [] })
      },
      readAccessToken: async () => 'expired-token',
      clearAccessToken: async (serverURL) => {
        cleared.push(serverURL)
      },
      readSelectedWorkspace: () => null,
      writeSelectedWorkspace: () => undefined
    })
    const connection = await service.connect('https://cloud.example.com')
    expect(connection.status).toBe('authentication-required')
    expect(connection.client).toBeNull()
    expect(cleared).toEqual(['https://cloud.example.com'])
  })

  test('clears a workspace selection that is no longer authorized', async () => {
    const remote = fetchMock()
    const writes: Array<string | null> = []
    const service = createCloudConnectionService({
      fetch: remote.fetch,
      readSelectedWorkspace: () => '22222222-2222-4222-8222-222222222222',
      writeSelectedWorkspace: (_serverURL, id) => writes.push(id)
    })
    const connection = await service.connect('https://cloud.example.com')
    expect(connection.selectedWorkspaceId).toBe(workspaceId)
    expect(writes).toEqual([workspaceId])
  })
})
