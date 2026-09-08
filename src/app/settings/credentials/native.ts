import { invoke } from '@tauri-apps/api/core'

import { IS_TAURI } from '@open-pencil/core/constants'

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

function nativeCommand(command: string): string {
  if (!IS_TAURI || import.meta.env.MODE !== 'native-test') return command
  if (command === 'credential_read') return 'native_test_credential_read'
  if (command === 'credential_write') return 'native_test_credential_write'
  if (command === 'credential_remove') return 'native_test_credential_remove'
  return command
}

export class NativeCredentialStore implements CredentialStore {
  readonly backend = 'native' as const

  async availability(): Promise<CredentialStoreAvailability> {
    return this.#invoke('credential_store_availability')
  }

  async status(reference: CredentialRef): Promise<CredentialStatus> {
    const value = await this.read(reference)
    return value ? 'configured' : 'missing'
  }

  async read(reference: CredentialRef): Promise<string | null> {
    return this.#invoke(nativeCommand('credential_read'), { reference })
  }

  async write(reference: CredentialRef, value: string): Promise<void> {
    await this.#invoke(nativeCommand('credential_write'), { reference, value })
  }

  async remove(reference: CredentialRef): Promise<void> {
    await this.#invoke(nativeCommand('credential_remove'), { reference })
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
