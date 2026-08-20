import { describe, expect, test } from 'bun:test'

import { remoteDocumentId, storageCanvasId } from '@/app/storage/id'

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

  test('preserves legacy and non-Cloud IDs', () => {
    expect(storageCanvasId({ providerId: 's3-compatible', documentId: 'document-1' })).toBe(
      'document-1'
    )
    expect(storageCanvasId({ providerId: 'openpencil-cloud', documentId: 'legacy' })).toBe('legacy')
    expect(remoteDocumentId('local-key', { documentId: 'remote-id' })).toBe('remote-id')
  })
})
