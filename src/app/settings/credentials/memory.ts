import { credentialKey, validateCredentialValue } from '@/app/settings/credentials/reference'
import type {
  CredentialRef,
  CredentialStatus,
  CredentialStore
} from '@/app/settings/credentials/types'

export class MemoryCredentialStore implements CredentialStore {
  readonly backend = 'memory' as const
  readonly #values = new Map<string, string>()

  async availability() {
    return 'available' as const
  }

  async status(reference: CredentialRef): Promise<CredentialStatus> {
    return this.#values.has(credentialKey(reference)) ? 'configured' : 'missing'
  }

  async read(reference: CredentialRef): Promise<string | null> {
    return this.#values.get(credentialKey(reference)) ?? null
  }

  async write(reference: CredentialRef, value: string): Promise<void> {
    validateCredentialValue(value)
    this.#values.set(credentialKey(reference), value)
  }

  async remove(reference: CredentialRef): Promise<void> {
    this.#values.delete(credentialKey(reference))
  }
}
