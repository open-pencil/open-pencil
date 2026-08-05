import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { createS3StorageAdapterWithConfig, type S3StorageAdapter } from '../s3/adapter'
import { resolveR2S3Config } from './config'

export function createR2StorageAdapter(runtime: StorageProviderRuntime): S3StorageAdapter {
  // Conditional head updates are probe-verified for R2 (2026-08-04): a lost
  // head race surfaces as 412 → StorageConflictError instead of a silent
  // overwrite. See the matching `conflictProtection: 'prevent'` registration.
  return createS3StorageAdapterWithConfig(() => resolveR2S3Config(runtime), {
    conditionalHeadUpdates: true
  })
}
