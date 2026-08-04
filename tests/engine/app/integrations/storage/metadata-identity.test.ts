import { describe, expect, test } from 'bun:test'

import {
  parseStorageDocumentMetadata,
  serializeStorageDocumentMetadata
} from '@/app/integrations/storage/metadata'
import type { StorageDocumentMetadata } from '@/app/integrations/storage/types'

const FALLBACK: StorageDocumentMetadata = {
  name: 'fallback',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sourceFormat: 'fig',
  trashedAt: null
}

/**
 * The sidecar schema addition that carries conflict identity. Backward
 * compatible in both directions: new fields are omitted when unknown, and
 * their absence in old sidecars means "unknown", never "different".
 */
describe('sidecar identity fields', () => {
  test('bodyId and stateId round-trip through serialize/parse', () => {
    const written: StorageDocumentMetadata = {
      name: 'Doc',
      updatedAt: '2026-08-04T00:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null,
      bodyId: 'sha256:body',
      stateId: 'sha256:state'
    }

    const parsed = parseStorageDocumentMetadata(
      new TextEncoder().encode(serializeStorageDocumentMetadata(written)),
      FALLBACK
    )

    expect(parsed.authoritative).toBe(true)
    expect(parsed.metadata.bodyId).toBe('sha256:body')
    expect(parsed.metadata.stateId).toBe('sha256:state')
  })

  test('identity fields are omitted entirely when unknown', () => {
    const serialized = serializeStorageDocumentMetadata({
      name: 'Doc',
      updatedAt: '2026-08-04T00:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null
    })

    expect(JSON.parse(serialized)).toEqual({
      name: 'Doc',
      updatedAt: '2026-08-04T00:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null
    })
  })

  test('a legacy sidecar without identity parses with absent identity', () => {
    const legacy = JSON.stringify({
      name: 'Legacy',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sourceFormat: 'fig',
      trashedAt: null
    })

    const parsed = parseStorageDocumentMetadata(new TextEncoder().encode(legacy), FALLBACK)

    expect(parsed.authoritative).toBe(true)
    expect(parsed.metadata.bodyId).toBeUndefined()
    expect(parsed.metadata.stateId).toBeUndefined()
  })
})
