import { watch } from 'vue'

import { forgetRecentStorageProfile } from '@/app/recent-files'
import { getLocalCanvasStore } from '@/app/storage/local-store'

import { cloudServers } from '../servers/store'
import { CLOUD_STORAGE_PROVIDER_ID } from './token'

/**
 * Forgets what this device kept of the account signed in to a server, so the next account here
 * does not find it in Recent: the server's recent documents, and its copies already uploaded.
 * A copy with changes not yet uploaded stays, to upload once its account signs back in.
 */
export async function forgetCloudAccountCopies(serverId: string): Promise<void> {
  forgetRecentStorageProfile(CLOUD_STORAGE_PROVIDER_ID, serverId)
  const store = getLocalCanvasStore()
  const copies = await store.listMetas(true)
  await Promise.all(
    copies
      .filter(
        (copy) =>
          copy.providerId === CLOUD_STORAGE_PROVIDER_ID &&
          copy.profileId === serverId &&
          copy.syncStatus === 'synced' &&
          !copy.tombstoned
      )
      .map((copy) => store.remove(copy.id, { unchangedFrom: copy }))
  )
}

/**
 * Forgets the last account's copies when another signs in to a server where it had expired.
 * Signing out forgets them itself (`signOutOfCloud`).
 */
export function watchCloudAccountSwitches(): () => void {
  return watch(
    () => new Map(cloudServers.value.map((server) => [server.id, server.account?.id])),
    (accounts, previous) => {
      for (const [serverId, accountId] of accounts) {
        const before = previous.get(serverId)
        if (before && accountId && before !== accountId) {
          forgetCloudAccountCopies(serverId).catch((error: unknown) => {
            console.warn('[Cloud] Could not forget the account on this device', error)
          })
        }
      }
    }
  )
}
