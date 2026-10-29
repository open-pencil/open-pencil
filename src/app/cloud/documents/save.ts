import type { StorageLocation } from '@/app/integrations/storage'
import {
  saveDestinationKey,
  type SaveDestination,
  type SaveFailure
} from '@/app/storage/save-to/model'

import { openCloudConnect } from '../connect/flow'
import { cloudServerHost } from '../servers/address'
import { cloudServers, findCloudServer } from '../servers/store'
import { cloudAPIClient, checkedCloudConnection, cloudConnection } from '../sessions/connection'
import { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'

/**
 * The workspaces of every signed-in server, as places Save to can put a document. Servers still
 * being checked are waited for, so a fresh start does not look signed out.
 */
export async function cloudSaveDestinations(): Promise<SaveDestination[]> {
  await Promise.all(cloudServers.value.map((server) => checkedCloudConnection(server)))
  return cloudServers.value.flatMap((server) => {
    const connection = cloudConnection(server.id)
    if (connection.state !== 'signed-in') return []
    const place = { id: server.id, label: cloudServerHost(server.url) }
    return connection.workspaces.map((workspace): SaveDestination => {
      const location = {
        providerId: CLOUD_STORAGE_PROVIDER_ID,
        profileId: server.id,
        containerId: workspace.id
      }
      return {
        key: saveDestinationKey(location),
        location,
        label: workspace.name,
        kind: 'workspace',
        place,
        role: workspace.role
      }
    })
  })
}

/** Signs in to a server this app knows but is signed out of; false when there is none. */
export function signInToSaveTo(): boolean {
  const signedOut = cloudServers.value.find((server) => {
    const state = cloudConnection(server.id).state
    return state === 'expired' || state === 'signed-out'
  })
  if (signedOut) openCloudConnect({ serverId: signedOut.id })
  return signedOut !== undefined
}

/**
 * Why a document's first upload to a Cloud workspace failed, from the workspace's limits: the
 * server refuses a file over its size limit, or one that does not fit the remaining storage,
 * without saying which. Null for anywhere that is not a Cloud workspace.
 */
export async function cloudUploadFailure(
  location: StorageLocation,
  size: number
): Promise<SaveFailure | null> {
  const { providerId, profileId, containerId } = location
  if (providerId !== CLOUD_STORAGE_PROVIDER_ID || !profileId || !containerId) return null
  const server = findCloudServer(profileId)
  const discovery = server ? cloudConnection(server.id).discovery : null
  if (!server || !discovery) return { reason: 'unavailable' }
  const entitlements = await cloudAPIClient(server, discovery)
    .getWorkspaceEntitlements(containerId)
    .catch(() => null)
  if (!entitlements) return { reason: 'unavailable' }
  const { limits, usage } = entitlements
  if (size > limits.maximumFileBytes) {
    return { reason: 'too-large', limitBytes: limits.maximumFileBytes }
  }
  const stored = usage.committedStorageBytes + usage.reservedStorageBytes
  if (limits.maximumStorageBytes !== null && stored + size > limits.maximumStorageBytes) {
    return { reason: 'quota' }
  }
  return { reason: 'unavailable' }
}
