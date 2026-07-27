export type CredentialRef = {
  integrationId: string
  profileId: string
  field: string
}

export type CredentialStoreAvailability = 'available' | 'locked' | 'unavailable'
export type CredentialStatus = 'configured' | 'missing' | 'locked' | 'unavailable'
export type CredentialBackend = 'native' | 'browser' | 'memory'
export type CredentialErrorCode =
  | 'invalid-reference'
  | 'invalid-value'
  | 'locked'
  | 'unavailable'
  | 'failed'

export class CredentialStoreError extends Error {
  constructor(
    readonly code: CredentialErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'CredentialStoreError'
  }
}

export interface CredentialStore {
  readonly backend: CredentialBackend
  availability(): Promise<CredentialStoreAvailability>
  status(reference: CredentialRef): Promise<CredentialStatus>
  read(reference: CredentialRef): Promise<string | null>
  write(reference: CredentialRef, value: string): Promise<void>
  remove(reference: CredentialRef): Promise<void>
}

export interface CredentialManager {
  readonly backend: CredentialBackend
  availability(): Promise<CredentialStoreAvailability>
  status(reference: CredentialRef): Promise<CredentialStatus>
  set(reference: CredentialRef, value: string): Promise<void>
  clear(reference: CredentialRef): Promise<void>
}

export interface CredentialResolver {
  resolve(reference: CredentialRef): Promise<string | null>
}
