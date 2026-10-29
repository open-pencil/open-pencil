import { cloudSaveDestinations } from '@/app/cloud/integration'
import {
  activeStorageProviderID,
  isStorageConfigured,
  readStoragePreferences
} from '@/app/integrations/storage'

import { saveDestinationKey, type SaveDestination } from './model'

async function bucketDestinations(): Promise<SaveDestination[]> {
  const providerId = activeStorageProviderID.value
  if (!(await isStorageConfigured(providerId))) return []
  const location = { providerId }
  const bucket = readStoragePreferences(providerId).bucket.trim()
  return [
    {
      key: saveDestinationKey(location),
      location,
      label: bucket || providerId,
      kind: 'bucket',
      place: null
    }
  ]
}

/**
 * Everywhere this device can save a document to now. A source that fails to answer, such as a
 * server that is down, leaves out only its own destinations.
 */
export async function listSaveDestinations(): Promise<SaveDestination[]> {
  const sources = [cloudSaveDestinations(), bucketDestinations()]
  const results = await Promise.allSettled(sources)
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
}
