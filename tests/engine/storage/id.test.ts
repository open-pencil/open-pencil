import { describe, expect, test } from 'bun:test'

import { localStorageIdentity, remoteDocumentId, storageCanvasId } from '@/app/storage/id'

describe('storage canvas identity', () => {
  test('namespaces Cloud documents by connection', () => {
    expect(
      storageCanvasId({
        providerId: 'openpencil-cloud',
        connectionId: 'connection-a',
        documentId: 'document-1'
      })
    ).toBe('openpencil-cloud:connection-a:document-1')
    expect(
      storageCanvasId({
        providerId: 'openpencil-cloud',
        connectionId: 'connection-b',
        documentId: 'document-1'
      })
    ).not.toBe('openpencil-cloud:connection-a:document-1')
  })

  test('projects complete Cloud and direct-storage identities', () => {
    expect(
      localStorageIdentity({
        providerId: 'openpencil-cloud',
        connectionId: 'connection-a',
        workspaceId: 'workspace-a',
        documentId: 'document-1'
      })
    ).toEqual({
      providerId: 'openpencil-cloud',
      connectionId: 'connection-a',
      workspaceId: 'workspace-a',
      documentId: 'document-1',
      canvasId: 'openpencil-cloud:connection-a:document-1'
    })
    expect(localStorageIdentity({ providerId: 's3-compatible', documentId: 'document-1' })).toEqual(
      {
        providerId: 's3-compatible',
        documentId: 'document-1',
        canvasId: 'document-1'
      }
    )
  })

  test('preserves non-Cloud IDs and rejects incomplete Cloud identities', () => {
    expect(storageCanvasId({ providerId: 's3-compatible', documentId: 'document-1' })).toBe(
      'document-1'
    )
    expect(() =>
      storageCanvasId({
        providerId: 'openpencil-cloud',
        connectionId: '',
        documentId: 'invalid'
      })
    ).toThrow('Cloud connection ID is required')
    expect(
      remoteDocumentId('local-key', {
        providerId: 'openpencil-cloud',
        documentId: 'remote-id'
      })
    ).toBe('remote-id')
    expect(() => remoteDocumentId('local-key', { providerId: 'openpencil-cloud' })).toThrow(
      'Cloud document metadata is missing its remote document ID'
    )
  })
})
