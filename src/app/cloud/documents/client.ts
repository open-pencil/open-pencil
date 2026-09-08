import { cloudConnectionService } from '@/app/cloud/sessions/service'
import { storagePreferencesForBinding } from '@/app/integrations/storage/binding'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'

/** A document request is always scoped by its persisted owner, never by UI selection. */
export async function cloudDocumentClient(binding: StorageDocumentBinding) {
  if (binding.providerId !== 'openpencil-cloud')
    throw new Error('This document is not stored in OpenPencil Cloud')
  const preferences = storagePreferencesForBinding(binding)
  const serverURL = preferences['server-url']
  if (!serverURL) throw new Error('Cloud document connection is unavailable')
  const connection = await cloudConnectionService.connect(serverURL)
  if (!connection.client) throw new Error('OpenPencil Cloud is not connected')
  return { binding, client: connection.client, serverURL, discovery: connection.discovery }
}
