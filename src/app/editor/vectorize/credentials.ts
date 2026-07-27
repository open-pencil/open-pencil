import { appCredentialServices } from '@/app/settings/credentials/app'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

import type { VectorizeProviderID } from './types'

export function vectorizeCredentialRef(providerID: VectorizeProviderID): CredentialRef {
  return credentialRef(`vectorize-${providerID}`, 'api-key')
}

export const VECTORIZE_CREDENTIAL_REFS = [
  vectorizeCredentialRef('recraft'),
  vectorizeCredentialRef('fal')
] as const

export function vectorizeCredentialStatus(
  providerID: VectorizeProviderID
): Promise<CredentialStatus> {
  return appCredentialServices.manager.status(vectorizeCredentialRef(providerID))
}

export async function setVectorizeCredential(
  providerID: VectorizeProviderID,
  value: string
): Promise<void> {
  const reference = vectorizeCredentialRef(providerID)
  const credential = value.trim()
  if (credential) await appCredentialServices.manager.set(reference, credential)
  else await appCredentialServices.manager.clear(reference)
}

export function resolveVectorizeCredential(
  providerID: VectorizeProviderID
): Promise<string | null> {
  return appCredentialServices.resolver.resolve(vectorizeCredentialRef(providerID))
}
