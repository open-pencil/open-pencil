import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import { S3HttpError } from '@/app/integrations/storage/s3/client'
import { isPermanentError } from '@/app/storage/sync/engine'

describe('storage sync error classification', () => {
  test('any S3 4xx is permanent except 429 rate limiting, which heals on retry', () => {
    expect(isPermanentError(new S3HttpError(412, 'PreconditionFailed'))).toBe(true)
    expect(isPermanentError(new S3HttpError(401, 'Unauthorized'))).toBe(true)
    expect(isPermanentError(new S3HttpError(403, 'AccessDenied'))).toBe(true)
    expect(isPermanentError(new S3HttpError(404, 'NoSuchKey'))).toBe(true)
    expect(isPermanentError(new S3HttpError(429, 'TooManyRequests'))).toBe(false)
    expect(isPermanentError(new S3HttpError(503, 'ServiceUnavailable'))).toBe(false)
    expect(isPermanentError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isPermanentError(new Error('access denied'))).toBe(false)
  })
})
