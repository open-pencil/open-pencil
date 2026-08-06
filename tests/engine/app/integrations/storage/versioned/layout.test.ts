import { describe, expect, test } from 'bun:test'

import {
  bodyIdFromKey,
  bodyKey,
  documentHeadKey,
  documentIdFromFigKey,
  documentIdFromHeadKey,
  stateIdFromManifestKey,
  versionManifestKey
} from '@/app/integrations/storage/namespace'
import type { StorageDocumentMetadata } from '@/app/integrations/storage/types'
import {
  DOCUMENT_HEAD_SCHEMA,
  HEAD_HISTORY_LIMIT,
  nextDocumentHead,
  parseDocumentHead,
  serializeDocumentHead
} from '@/app/integrations/storage/versioned/head'
import {
  parseVersionManifest,
  serializeVersionManifest,
  VERSION_MANIFEST_SCHEMA
} from '@/app/integrations/storage/versioned/manifest'

const METADATA: StorageDocumentMetadata = {
  name: 'Deck',
  updatedAt: '2026-08-04T10:00:00.000Z',
  sourceFormat: 'fig',
  trashedAt: null,
  bodyId: 'sha256:body',
  stateId: 'sha256:state'
}

describe('versioned layout keys', () => {
  test('body and manifest keys round-trip their ids', () => {
    expect(bodyIdFromKey(bodyKey('sha256:abc'))).toBe('sha256:abc')
    expect(stateIdFromManifestKey(versionManifestKey('sha256:def'))).toBe('sha256:def')
  })

  test('head and fig keys parse disjointly under the same prefix', () => {
    const head = documentHeadKey('doc-1')
    const fig = documentIdFromFigKey(head)
    expect(head).toBe('open_pencil_storage/canvases/doc-1/head.json')
    // Legacy callers must never mistake a head for a body.
    expect(fig).toBeNull()
    expect(documentIdFromHeadKey(head)).toBe('doc-1')
    expect(documentIdFromHeadKey('open_pencil_storage/canvases/doc-1.fig')).toBeNull()
    expect(documentIdFromFigKey('open_pencil_storage/canvases/doc-1.fig')).toBe('doc-1')
  })

  test('nested ids are rejected by every parser', () => {
    expect(documentIdFromHeadKey('open_pencil_storage/canvases/a/b/head.json')).toBeNull()
    expect(bodyIdFromKey('open_pencil_storage/bodies/a/b.fig')).toBeNull()
    expect(stateIdFromManifestKey('open_pencil_storage/versions/a/b.json')).toBeNull()
  })
})

describe('version manifest', () => {
  test('round-trips bodyId and metadata', () => {
    const parsed = parseVersionManifest(
      new TextEncoder().encode(
        serializeVersionManifest({
          schema: VERSION_MANIFEST_SCHEMA,
          bodyId: 'sha256:body',
          metadata: METADATA
        })
      ),
      METADATA
    )
    expect(parsed?.manifest.bodyId).toBe('sha256:body')
    expect(parsed?.manifest.metadata.name).toBe('Deck')
    expect(parsed?.authoritative).toBe(true)
  })

  test('rejects unknown schema, missing bodyId, and corrupt JSON', () => {
    const good = { schema: VERSION_MANIFEST_SCHEMA, bodyId: 'b', metadata: METADATA }
    expect(
      parseVersionManifest(
        new TextEncoder().encode(JSON.stringify({ ...good, schema: 2 })),
        METADATA
      )
    ).toBeNull()
    expect(
      parseVersionManifest(
        new TextEncoder().encode(JSON.stringify({ ...good, bodyId: '' })),
        METADATA
      )
    ).toBeNull()
    expect(parseVersionManifest(new TextEncoder().encode('{nope'), METADATA)).toBeNull()
    expect(parseVersionManifest(null, METADATA)).toBeNull()
  })

  test('metadata without a name parses non-authoritative', () => {
    const parsed = parseVersionManifest(
      new TextEncoder().encode(
        serializeVersionManifest({
          schema: VERSION_MANIFEST_SCHEMA,
          bodyId: 'b',
          metadata: { ...METADATA, name: '   ' }
        })
      ),
      METADATA
    )
    expect(parsed?.authoritative).toBe(false)
  })
})

describe('document head', () => {
  test('nextDocumentHead prepends and retains the previous chain', () => {
    const first = nextDocumentHead('s1', null)
    const second = nextDocumentHead('s2', first)
    expect(second.stateId).toBe('s2')
    expect(second.history).toEqual(['s2', 's1'])
  })

  test('history is capped at the retention limit', () => {
    let head = nextDocumentHead('s0', null)
    for (let i = 1; i <= HEAD_HISTORY_LIMIT + 5; i++) {
      head = nextDocumentHead(`s${i}`, head)
    }
    expect(head.history).toHaveLength(HEAD_HISTORY_LIMIT)
    expect(head.history[0]).toBe(`s${HEAD_HISTORY_LIMIT + 5}`)
  })

  test('parse rejects wrong schema and survives a missing history', () => {
    expect(
      parseDocumentHead(new TextEncoder().encode(JSON.stringify({ schema: 9, stateId: 's' })))
    ).toBeNull()
    const noHistory = parseDocumentHead(
      new TextEncoder().encode(JSON.stringify({ schema: DOCUMENT_HEAD_SCHEMA, stateId: 's' }))
    )
    expect(noHistory?.history).toEqual([])
    const filtered = parseDocumentHead(
      new TextEncoder().encode(
        JSON.stringify({ schema: DOCUMENT_HEAD_SCHEMA, stateId: 's', history: ['a', 7, 'b'] })
      )
    )
    expect(filtered?.history).toEqual(['a', 'b'])
  })

  test('head serialisation round-trips', () => {
    const head = nextDocumentHead('s2', nextDocumentHead('s1', null))
    expect(parseDocumentHead(new TextEncoder().encode(serializeDocumentHead(head)))).toEqual(head)
  })
})
