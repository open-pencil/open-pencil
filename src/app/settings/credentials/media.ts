import { ref } from 'vue'

import {
  checkStockPhotoKey,
  setPexelsAPIKey,
  setUnsplashAccessKey,
  type StockPhotoKeyCheck
} from '@open-pencil/core/tools'

import { checkExaKey } from '@/app/ai/search/exa'

import { appCredentialServices } from './app'
import {
  EXA_CREDENTIAL,
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
/** The person's own Exa key for web search, used instead of Cloud credits when saved. */
export const exaKeyStatus = ref<CredentialStatus>('missing')
export async function refreshMediaCredentials(): Promise<void> {
  const [pexelsStatus, unsplashStatus, exaStatus] = await Promise.all([
    refreshStatus(PEXELS_CREDENTIAL),
    refreshStatus(UNSPLASH_CREDENTIAL),
    refreshStatus(EXA_CREDENTIAL)
  ])
  pexelsKeyStatus.value = pexelsStatus
  unsplashKeyStatus.value = unsplashStatus
  exaKeyStatus.value = exaStatus
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
export async function setExaKey(key: string): Promise<void> {
  exaKeyStatus.value = await setMediaKey(EXA_CREDENTIAL, key)
}
/** The saved Exa key, read when a search needs it. */
export async function resolveExaKey(): Promise<string | null> {
  return (await refreshStatus(EXA_CREDENTIAL)) === 'configured'
    ? resolveMediaCredential(EXA_CREDENTIAL)
    : null
}
const KEY_REFERENCES = {
  pexels: PEXELS_CREDENTIAL,
  unsplash: UNSPLASH_CREDENTIAL,
  exa: EXA_CREDENTIAL
}
/**
 * Checks the key typed in Settings, or the saved one when nothing is typed, with one request to
 * the service; `missing` when there is neither.
 */
export async function checkMediaKey(
  service: keyof typeof KEY_REFERENCES,
  typed: string,
  useSaved: boolean
): Promise<StockPhotoKeyCheck | 'missing'> {
  const reference = KEY_REFERENCES[service]
  const key = typed.trim() || (useSaved ? await resolveMediaCredential(reference) : null)
  if (!key) return 'missing'
  return service === 'exa' ? checkExaKey(key) : checkStockPhotoKey(service, key)
}
export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await initializeCredentialMigration()
  await setAppCredentialPersistence(remembered)
  await refreshMediaCredentials()
  credentialPersistenceRevision.value++
}
