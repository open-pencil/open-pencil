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
