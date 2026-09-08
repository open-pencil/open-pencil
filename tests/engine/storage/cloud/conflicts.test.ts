import { describe, expect, test } from 'bun:test'

import { CloudAPIError } from '@open-pencil/cloud/client'

import { storageSyncFailureKind } from '@/app/storage/sync/engine'

describe('Cloud storage sync failures', () => {
  test('classifies revision conflicts without retrying them as transient failures', () => {
    expect(
      storageSyncFailureKind(
        new CloudAPIError('OpenPencil Cloud request failed with HTTP 409', 409, 'revision_conflict')
      )
    ).toBe('conflict')
  })

  test('keeps server failures transient and auth failures permanent', () => {
    expect(storageSyncFailureKind(new CloudAPIError('Server unavailable', 503))).toBe('transient')
    expect(storageSyncFailureKind(new CloudAPIError('Unauthorized', 401, 'unauthorized'))).toBe(
      'permanent'
    )
  })
})
