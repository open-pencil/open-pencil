import { createCloudStorageAdapter } from '@/app/integrations/storage/cloud/adapter'
import { defineStorageProvider } from '@/app/integrations/storage/registry'
import type { StorageProviderRegistration } from '@/app/integrations/storage/types'

import { CLOUD_SESSION_FIELD, CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

/**
 * The storage providers Cloud adds: servers are profiles and workspaces containers, and signing
 * in replaces typed credentials. Kept apart from the rest of the integration, which the storage
 * registry would otherwise load in a cycle.
 */
export const CLOUD_STORAGE_PROVIDERS: readonly StorageProviderRegistration[] = [
  defineStorageProvider({
    id: CLOUD_STORAGE_PROVIDER_ID,
    label: 'OpenPencil Cloud',
    description: 'Workspaces on OpenPencil Cloud or your team’s own server',
    preferenceFields: [],
    credentialFields: [{ id: CLOUD_SESSION_FIELD, label: 'Session' }],
    createAdapter: (runtime) => createCloudStorageAdapter(runtime)
  })
]
