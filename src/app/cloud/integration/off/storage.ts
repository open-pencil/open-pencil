import type { StorageProviderRegistration } from '@/app/integrations/storage/types'

/** A build without Cloud adds no storage providers. */
export const CLOUD_STORAGE_PROVIDERS: readonly StorageProviderRegistration[] = []
