import { describe, expect, test } from 'bun:test'

import { applyLocalMetaToCanvases } from '@/app/cloud/home/sync-badges'
import type { LocalCanvasMeta } from '@/app/cloud/local-store'
import type { CloudCanvas } from '@/app/cloud/types'

function meta(
  partial: Partial<LocalCanvasMeta> & Pick<LocalCanvasMeta, 'id' | 'syncStatus'>
): LocalCanvasMeta {
  return {
    providerId: 's3-compatible',
    name: 'Doc',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    lastSyncedAt: null,
    lastSyncError: null,
    tombstoned: false,
    hasFig: true,
    hasThumb: false,
    ...partial
  }
}

describe('applyLocalMetaToCanvases', () => {
  test('clears sticky pending after local meta becomes synced', () => {
    const list: CloudCanvas[] = [
      {
        id: 'a',
        name: 'CarrierLogos (1)',
        updatedAt: '2026-01-01T00:00:00.000Z',
        thumbnailUrl: null,
        syncStatus: 'pending'
      }
    ]
    const next = applyLocalMetaToCanvases(list, [
      meta({ id: 'a', name: 'CarrierLogos (1)', syncStatus: 'synced' })
    ])
    expect(next).not.toBe(list)
    expect(next[0]?.syncStatus).toBe('synced')
  })

  test('returns same array reference when nothing changed', () => {
    const list: CloudCanvas[] = [
      {
        id: 'a',
        name: 'Doc',
        updatedAt: '2026-01-01T00:00:00.000Z',
        thumbnailUrl: 'blob:keep',
        syncStatus: 'synced'
      }
    ]
    const next = applyLocalMetaToCanvases(list, [
      meta({ id: 'a', syncStatus: 'synced', updatedAt: '2026-01-01T00:00:00.000Z' })
    ])
    expect(next).toBe(list)
    expect(next[0]?.thumbnailUrl).toBe('blob:keep')
  })
})
