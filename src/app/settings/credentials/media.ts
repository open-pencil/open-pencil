import { ref } from 'vue'

import {
  checkStockPhotoKey,
  setPexelsAPIKey,
  setUnsplashAccessKey,
  type StockPhotoKeyCheck
} from '@open-pencil/core/tools'

import { appCredentialServices } from './app'
import {
  hasLegacyCredential,
  initializeCredentialMigration,
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL
} from './migration'
import { setAppCredentialPersistence } from './persistence'
import type { CredentialRef, CredentialStatus } from './types'
export const credentialPersistenceRevision = ref(0)
async function refreshStatus(reference: CredentialRef): Promise<CredentialStatus> {
  const status = await appCredentialServices.manager.status(reference)
  return status === 'missing' && hasLegacyCredential(reference) ? 'configured' : status
}
async function resolveMediaCredential(reference: CredentialRef): Promise<string | null> {
  await initializeCredentialMigration()
  return appCredentialServices.resolver.resolve(reference)
}
export const pexelsKeyStatus = ref<CredentialStatus>('missing')
export const unsplashKeyStatus = ref<CredentialStatus>('missing')
export async function refreshMediaCredentials(): Promise<void> {
  const [pexelsStatus, unsplashStatus] = await Promise.all([
    refreshStatus(PEXELS_CREDENTIAL),
    refreshStatus(UNSPLASH_CREDENTIAL)
  ])
  pexelsKeyStatus.value = pexelsStatus
  unsplashKeyStatus.value = unsplashStatus
  setPexelsAPIKey(
    pexelsStatus === 'configured' ? () => resolveMediaCredential(PEXELS_CREDENTIAL) : null
  )
  setUnsplashAccessKey(
    unsplashStatus === 'configured' ? () => resolveMediaCredential(UNSPLASH_CREDENTIAL) : null
  )
}
async function setMediaKey(reference: CredentialRef, key: string): Promise<CredentialStatus> {
  // Migrate first so clearing also removes a value that only exists in legacy storage.
  await initializeCredentialMigration()
  const value = key.trim()
  if (value) await appCredentialServices.manager.set(reference, value)
  else await appCredentialServices.manager.clear(reference)
  return refreshStatus(reference)
}
export async function setPexelsKey(key: string): Promise<void> {
  pexelsKeyStatus.value = await setMediaKey(PEXELS_CREDENTIAL, key)
  setPexelsAPIKey(
    pexelsKeyStatus.value === 'configured' ? () => resolveMediaCredential(PEXELS_CREDENTIAL) : null
  )
}
export async function setUnsplashKey(key: string): Promise<void> {
  unsplashKeyStatus.value = await setMediaKey(UNSPLASH_CREDENTIAL, key)
  setUnsplashAccessKey(
    unsplashKeyStatus.value === 'configured'
      ? () => resolveMediaCredential(UNSPLASH_CREDENTIAL)
      : null
  )
}
/**
 * Checks the key typed in Settings, or the saved one when nothing is typed, with one request to
 * the service; `missing` when there is neither.
 */
export async function checkMediaKey(
  service: 'pexels' | 'unsplash',
  typed: string,
  useSaved: boolean
): Promise<StockPhotoKeyCheck | 'missing'> {
  const reference = service === 'pexels' ? PEXELS_CREDENTIAL : UNSPLASH_CREDENTIAL
  const key = typed.trim() || (useSaved ? await resolveMediaCredential(reference) : null)
  return key ? checkStockPhotoKey(service, key) : 'missing'
}
export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await initializeCredentialMigration()
  await setAppCredentialPersistence(remembered)
  await refreshMediaCredentials()
  credentialPersistenceRevision.value++
}
