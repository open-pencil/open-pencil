import type { CredentialRef } from '@/app/settings/credentials/types'
import { CredentialStoreError } from '@/app/settings/credentials/types'

const CREDENTIAL_SEGMENT_PATTERN = /^[a-z0-9._-]{1,64}$/
const MAX_CREDENTIAL_LENGTH = 16 * 1024

export function credentialKey(reference: CredentialRef): string {
  const segments = [reference.integrationId, reference.profileId, reference.field]
  if (!segments.every((segment) => CREDENTIAL_SEGMENT_PATTERN.test(segment))) {
    throw new CredentialStoreError('invalid-reference', 'Credential reference is invalid')
  }
  return `v1:${segments.join(':')}`
}

export function validateCredentialValue(value: string): void {
  if (!value || new TextEncoder().encode(value).byteLength > MAX_CREDENTIAL_LENGTH) {
    throw new CredentialStoreError('invalid-value', 'Credential value is invalid')
  }
}

export function credentialRef(
  integrationId: string,
  field: string,
  profileId = 'default'
): CredentialRef {
  const reference = { integrationId, profileId, field }
  credentialKey(reference)
  return reference
}
