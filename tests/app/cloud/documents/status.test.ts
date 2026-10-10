import { describe, expect, test } from 'bun:test'

import { cloudSyncState } from '@/app/cloud/documents/status'

describe('Cloud document status', () => {
  test('puts a choice to make or a failure ahead of anything in flight', () => {
    expect(cloudSyncState({ syncStatus: 'conflict' }, true, true)).toBe('conflict')
    expect(cloudSyncState({ syncStatus: 'error' }, true, true)).toBe('error')
  })

  test('shows an upload in flight, then waiting changes, offline or not', () => {
    expect(cloudSyncState({ syncStatus: 'pending' }, true, true)).toBe('uploading')
    expect(cloudSyncState({ syncStatus: 'pending' }, false, true)).toBe('pending')
    expect(cloudSyncState({ syncStatus: 'pending' }, false, false)).toBe('offline')
  })

  test('calls everything else saved', () => {
    expect(cloudSyncState({ syncStatus: 'synced' }, false, false)).toBe('synced')
    expect(cloudSyncState(null, false, true)).toBe('synced')
  })
})
