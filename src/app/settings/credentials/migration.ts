import { AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'

import { appCredentialStore } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import { browserCredentialStorage } from '@/app/settings/credentials/storage'
import type { CredentialRef, CredentialStore } from '@/app/settings/credentials/types'

const STORAGE_PREFIX = 'open-pencil:'
const MIGRATION_VERSION_KEY = `${STORAGE_PREFIX}credential-migration`
const MIGRATION_VERSION = '1'
const LEGACY_OPENROUTER_KEY = `${STORAGE_PREFIX}openrouter-api-key`

export function providerCredentialRef(
  providerId: AIProviderID,
  profileId = 'default'
): CredentialRef {
  if (providerId.startsWith('acp:')) {
    throw new Error('ACP agents do not use API-key credentials')
  }
  return credentialRef(providerId, 'api-key', profileId)
}

export const PEXELS_CREDENTIAL = credentialRef('pexels', 'api-key')
export const UNSPLASH_CREDENTIAL = credentialRef('unsplash', 'access-key')

type LegacyCredential = {
  storageKey: string
  reference: CredentialRef
}

function legacyCredentials(storage: Storage): LegacyCredential[] {
  const credentials: LegacyCredential[] = [
    { storageKey: LEGACY_OPENROUTER_KEY, reference: providerCredentialRef('openrouter') },
    { storageKey: `${STORAGE_PREFIX}pexels-api-key`, reference: PEXELS_CREDENTIAL },
    { storageKey: `${STORAGE_PREFIX}unsplash-access-key`, reference: UNSPLASH_CREDENTIAL }
  ]

  for (let index = 0; index < storage.length; index++) {
    const storageKey = storage.key(index)
    if (!storageKey?.startsWith(`${STORAGE_PREFIX}ai-key:`)) continue
    const legacyProviderId = storageKey.slice(`${STORAGE_PREFIX}ai-key:`.length)
    const providerId = AI_PROVIDERS.find((provider) => provider.id === legacyProviderId)?.id
    if (!providerId) continue
    credentials.push({ storageKey, reference: providerCredentialRef(providerId) })
  }

  return credentials
}

export async function migrateLegacyCredentials(
  storage: Storage,
  store: CredentialStore
): Promise<boolean> {
  if (storage.getItem(MIGRATION_VERSION_KEY) === MIGRATION_VERSION) return true
  if ((await store.availability()) !== 'available') return false

  const credentials = legacyCredentials(storage)
  for (const { storageKey, reference } of credentials) {
    const legacyValue = storage.getItem(storageKey)?.trim()
    if (!legacyValue) continue

    const existing = await store.read(reference)
    if (existing === null) await store.write(reference, legacyValue)
    if ((await store.read(reference)) === null) return false
    storage.removeItem(storageKey)
  }

  storage.setItem(MIGRATION_VERSION_KEY, MIGRATION_VERSION)
  return true
}

export async function initializeCredentialMigration(): Promise<boolean> {
  const storage = browserCredentialStorage()
  if (!storage) return true
  return migrateLegacyCredentials(storage, appCredentialStore)
}
