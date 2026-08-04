import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { createS3StorageAdapterWithConfig, type S3StorageAdapter } from '../s3/adapter'
import { resolveBackblazeS3Config } from './config'

export function createBackblazeStorageAdapter(runtime: StorageProviderRuntime): S3StorageAdapter {
  return createS3StorageAdapterWithConfig(() => resolveBackblazeS3Config(runtime))
}
