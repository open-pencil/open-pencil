import {
  cloudProviderId,
  isCloudConfigured,
  isS3ConfigComplete,
  readS3Config
} from '@/app/cloud/credentials'
import { createCloudAdapter } from '@/app/cloud/registry'
import type { CloudStorageAdapter } from '@/app/cloud/types'

/** Returns the active adapter when credentials are complete; otherwise null. */
export function getActiveCloudAdapter(): CloudStorageAdapter | null {
  if (!isCloudConfigured.value) return null
  const config = readS3Config()
  if (!isS3ConfigComplete(config)) return null
  return createCloudAdapter(cloudProviderId.value, config)
}

export function requireActiveCloudAdapter(): CloudStorageAdapter {
  const adapter = getActiveCloudAdapter()
  if (!adapter) {
    throw new Error('Cloud storage is not configured')
  }
  return adapter
}
