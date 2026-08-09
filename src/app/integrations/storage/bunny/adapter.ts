import type { StorageProviderRuntime } from '@/app/integrations/storage/types'

import { createS3StorageAdapterWithConfig, type S3StorageAdapter } from '../s3/adapter'
import { resolveBunnyS3Config } from './config'

export function createBunnyStorageAdapter(runtime: StorageProviderRuntime): S3StorageAdapter {
  return createS3StorageAdapterWithConfig(() => resolveBunnyS3Config(runtime))
}
