import { invoke } from '@tauri-apps/api/core'

import {
  CredentialStoreError,
  type CredentialErrorCode,
  type CredentialRef,
  type CredentialStatus,
  type CredentialStore,
  type CredentialStoreAvailability
} from '@/app/settings/credentials/types'

type NativeCredentialError = {
  code?: CredentialErrorCode
  message?: string
}

export class NativeCredentialStore implements CredentialStore {
  readonly backend = 'native' as const

  async availability(): Promise<CredentialStoreAvailability> {
    return this.#invoke('credential_store_availability')
  }

  async status(reference: CredentialRef): Promise<CredentialStatus> {
    return this.#invoke('credential_status', { reference })
  }

  async read(reference: CredentialRef): Promise<string | null> {
    return this.#invoke('credential_read', { reference })
  }

  async write(reference: CredentialRef, value: string): Promise<void> {
    await this.#invoke('credential_write', { reference, value })
  }

  async remove(reference: CredentialRef): Promise<void> {
    await this.#invoke('credential_remove', { reference })
  }

  async #invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
      return await invoke<T>(command, args)
    } catch (error) {
      const nativeError = error as NativeCredentialError
      throw new CredentialStoreError(
        nativeError.code ?? 'failed',
        nativeError.message ?? 'System credential operation failed'
      )
    }
  }
}
