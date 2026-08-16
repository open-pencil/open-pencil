import { describe, expect, test } from 'bun:test'

import { CloudAPIError, createCloudAPIClient } from '@open-pencil/cloud/client'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const documentId = '22222222-2222-4222-8222-222222222222'
const revisionId = '33333333-3333-4333-8333-333333333333'
const collaborationTicket = {
  token: 'signed-token',
  documentId,
  roomId: `cloud:${documentId}:2`,
  roomKey: 'r'.repeat(43),
  principal: { kind: 'guest' as const, guestId: 'stable-guest-id-123', name: 'Guest' },
  permission: 'view' as const,
  roomEpoch: 2,
  expiresAt: '2026-01-01T00:05:00.000Z',
  serverEnforcedWrites: false as const
}

const document = {
  id: documentId,
  workspaceId,
  name: 'Homepage',
  currentRevisionId: revisionId,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('createCloudAPIClient', () => {
  test('validates document metadata and sends authenticated requests', async () => {
    const requests: Request[] = []
    const client = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ documents: [document] })
      }
    })

    expect(await client.listDocuments(workspaceId)).toEqual([document])
    expect(requests[0]?.url).toBe(
      `https://cloud.example.com/api/workspaces/${workspaceId}/documents`
    )
    expect(requests[0]?.credentials).toBe('include')
  })

  test('creates upload sessions and commits revisions', async () => {
    const requests: Request[] = []
    const client = createCloudAPIClient('https://cloud.example.com/api/', {
      fetch: async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        if (request.url.endsWith('/uploads')) {
          return Response.json({
            id: '44444444-4444-4444-8444-444444444444',
            upload: {
              kind: 'single',
              url: 'https://objects.example.com/upload',
              method: 'PUT',
              headers: { 'x-amz-checksum-sha256': 'checksum' },
              expiresAt: '2026-01-01T00:15:00.000Z'
            }
          })
        }
        return Response.json({ document })
      }
    })

    const upload = await client.createUpload(documentId, {
      baseRevisionId: revisionId,
      byteSize: 5,
      checksum: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      contentType: 'application/octet-stream'
    })
    expect(upload.upload.kind).toBe('single')
    if (upload.upload.kind !== 'single') throw new Error('Expected a single upload')
    expect(upload.upload.method).toBe('PUT')
    expect(
      await client.commitUpload(upload.id, {
        checksum: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
      })
    ).toEqual(document)
    expect(requests.every((request) => request.method === 'POST')).toBe(true)
  })

  test('looks up authorized user profiles and accepts invitations', async () => {
    const invitationId = '44444444-4444-4444-8444-444444444444'
    const grant = {
      id: '55555555-5555-4555-8555-555555555555',
      documentId,
      userId: 'recipient-user',
      permission: 'view' as const,
      createdBy: 'owner-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
    const requests: Request[] = []
    const client = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        if (request.url.endsWith('/users/lookup')) {
          return Response.json({
            user: {
              id: 'recipient-user',
              name: 'Recipient',
              email: 'recipient@example.com',
              image: null
            }
          })
        }
        if (request.url.endsWith('/preview')) {
          return Response.json({
            invitation: {
              documentName: 'Homepage',
              inviterName: 'Alice',
              permission: 'view',
              expiresAt: '2026-01-08T00:00:00.000Z',
              recipientHint: 're*******@example.com'
            }
          })
        }
        return Response.json({ grant })
      }
    })

    expect(await client.lookupUser(documentId, { email: 'recipient@example.com' })).toEqual({
      id: 'recipient-user',
      name: 'Recipient',
      email: 'recipient@example.com',
      image: null
    })
    expect(
      await client.previewDocumentInvitation(invitationId, { token: 't'.repeat(32) })
    ).toMatchObject({ documentName: 'Homepage', recipientHint: 're*******@example.com' })
    expect(await client.acceptDocumentInvitation(invitationId, { token: 't'.repeat(32) })).toEqual(
      grant
    )
    expect(requests.map((request) => request.url)).toEqual([
      `https://cloud.example.com/api/documents/${documentId}/users/lookup`,
      `https://cloud.example.com/api/invitations/${invitationId}/preview`,
      `https://cloud.example.com/api/invitations/${invitationId}/accept`
    ])
  })

  test('requests and validates public collaboration tickets without dropping the API prefix', async () => {
    const requests: Request[] = []
    const client = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ ticket: collaborationTicket })
      }
    })

    expect(
      await client.getSharedCollaborationTicket('share-id', {
        secret: 'x'.repeat(32),
        guestName: 'Guest',
        guestId: 'stable-guest-id-123'
      })
    ).toEqual(collaborationTicket)
    expect(requests[0]?.url).toBe(
      'https://cloud.example.com/api/shares/share-id/collaboration-ticket'
    )
    expect(requests[0]?.credentials).toBe('include')
  })

  test('preserves stable API error codes', async () => {
    const client = createCloudAPIClient('https://cloud.example.com/api', {
      fetch: async () => Response.json({ error: { code: 'revision_conflict' } }, { status: 409 })
    })

    const error = await client.listDocuments(workspaceId).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(CloudAPIError)
    expect(error).toMatchObject({ status: 409, code: 'revision_conflict' })
  })
})
