import { describe, expect, test } from 'bun:test'

import { createCloudStorageAdapter } from '@/app/integrations/storage/cloud/adapter'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const documentId = '22222222-2222-4222-8222-222222222222'
const revisionId = '33333333-3333-4333-8333-333333333333'

function runtime() {
  return {
    preferences: {
      'server-url': 'https://cloud.example.com',
      'workspace-id': workspaceId
    },
    async resolveCredential() {
      return null
    }
  }
}

function document() {
  return {
    id: documentId,
    workspaceId,
    name: 'Homepage',
    currentRevisionId: revisionId,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('OpenPencil Cloud storage adapter', () => {
  test('lists workspace documents through discovery', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('.well-known')) {
        return Response.json({
          protocolVersion: '1',
          deployment: 'self-hosted',
          apiURL: 'https://cloud.example.com/api',
          authURL: 'https://cloud.example.com/api/auth',
          capabilities: { documents: true, workspaces: true, collaboration: false },
          authentication: { socialProviders: [], enterpriseSSO: false }
        })
      }
      if (url.endsWith('/api/session')) {
        return Response.json({
          user: { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
        })
      }
      if (url.endsWith('/api/workspaces')) {
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
      return Response.json({ documents: [document()] })
    }
    try {
      expect(await createCloudStorageAdapter(runtime()).listDocuments()).toEqual([
        {
          id: documentId,
          name: 'Homepage',
          updatedAt: '2026-01-01T00:00:00.000Z',
          metadataAuthoritative: true,
          remoteRevisionId: revisionId
        }
      ])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('uploads bytes with a checksum and commits the revision', async () => {
    const originalFetch = globalThis.fetch
    const requests: Request[] = []
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      if (request.url.includes('.well-known')) {
        return Response.json({
          protocolVersion: '1',
          deployment: 'self-hosted',
          apiURL: 'https://cloud.example.com/api',
          authURL: 'https://cloud.example.com/api/auth',
          capabilities: { documents: true, workspaces: true, collaboration: false },
          authentication: { socialProviders: [], enterpriseSSO: false }
        })
      }
      if (request.url.endsWith('/api/session')) {
        return Response.json({
          user: { userId: 'alice', email: 'alice@example.com', name: 'Alice' }
        })
      }
      if (request.url.endsWith('/workspaces')) {
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
      if (request.url.endsWith('/documents')) return Response.json({ documents: [document()] })
      if (request.url.endsWith('/uploads')) {
        return Response.json({
          id: '44444444-4444-4444-8444-444444444444',
          upload: {
            kind: 'single',
            url: 'https://objects.example.com/upload',
            method: 'PUT',
            headers: { 'x-amz-checksum-sha256': 'signed-checksum' },
            expiresAt: '2026-01-01T00:15:00.000Z'
          }
        })
      }
      if (request.url === 'https://objects.example.com/upload')
        return new Response(null, { status: 200 })
      return Response.json({ document: document() })
    }
    try {
      await createCloudStorageAdapter(runtime()).putDocument(
        documentId,
        new Uint8Array([1, 2, 3]),
        { name: 'Homepage', updatedAt: '2026-01-01T00:00:00.000Z' }
      )
      const uploadRequest = requests.find((request) => request.url.endsWith('/uploads'))
      expect(await uploadRequest?.json()).toMatchObject({ baseRevisionId: null })
      const objectRequest = requests.find((request) => request.url.includes('objects.example.com'))
      expect(objectRequest?.method).toBe('PUT')
      expect(objectRequest?.headers.get('x-amz-checksum-sha256')).toBe('signed-checksum')
      expect(requests.some((request) => request.url.endsWith('/commit'))).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
