import { describe, expect, test } from 'bun:test'

import type { StorageDocument } from '@/app/integrations/storage'
import { sortStorageDocuments } from '@/app/storage/sort'

function document(name: string, updatedAt: string): StorageDocument {
  return {
    id: name,
    name,
    updatedAt,
    sourceFormat: 'fig',
    trashedAt: null
  }
}

const documents = [
  document('Zulu', '2026-01-02T00:00:00.000Z'),
  document('alpha 10', '2026-01-03T00:00:00.000Z'),
  document('Alpha 2', '2026-01-01T00:00:00.000Z')
]

describe('storage document sorting', () => {
  test('sorts names naturally in either direction', () => {
    expect(sortStorageDocuments(documents, 'name-asc').map((item) => item.name)).toEqual([
      'Alpha 2',
      'alpha 10',
      'Zulu'
    ])
    expect(sortStorageDocuments(documents, 'name-desc').map((item) => item.name)).toEqual([
      'Zulu',
      'alpha 10',
      'Alpha 2'
    ])
  })

  test('sorts dates newest or oldest first', () => {
    expect(sortStorageDocuments(documents, 'date-desc').map((item) => item.name)).toEqual([
      'alpha 10',
      'Zulu',
      'Alpha 2'
    ])
    expect(sortStorageDocuments(documents, 'date-asc').map((item) => item.name)).toEqual([
      'Alpha 2',
      'Zulu',
      'alpha 10'
    ])
  })
})
