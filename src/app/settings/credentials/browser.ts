import type { DBSchema, IDBPDatabase } from 'idb'

import { credentialKey, validateCredentialValue } from '@/app/settings/credentials/reference'
import type {
  CredentialRef,
  CredentialStatus,
  CredentialStore,
  CredentialStoreAvailability
} from '@/app/settings/credentials/types'
import { CredentialStoreError } from '@/app/settings/credentials/types'
import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

const credentialDatabase = defineAppDatabase<CredentialDatabase>({
  name: APP_DATABASE_NAMES.credentials,
  version: 1,
  callbacks: {
    upgrade(database) {
      if (!database.objectStoreNames.contains('credentials')) {
        database.createObjectStore('credentials')
      }
      if (!database.objectStoreNames.contains('metadata')) {
        database.createObjectStore('metadata')
      }
    }
  }
})

const MASTER_KEY_ID = 'master-key'
const IV_LENGTH = 12

interface EncryptedCredential {
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const owned = new Uint8Array(bytes.byteLength)
  owned.set(bytes)
  return owned.buffer
}

interface CredentialDatabase extends DBSchema {
  credentials: {
    key: string
    value: EncryptedCredential
  }
  metadata: {
    key: string
    value: CryptoKey
  }
}

export class BrowserCredentialStore implements CredentialStore {
  readonly backend = 'browser' as const
  readonly #database: Promise<IDBPDatabase<CredentialDatabase>>
  #masterKeyPromise?: Promise<CryptoKey>

  constructor() {
    this.#database = openAppDatabase(credentialDatabase)
  }

  async availability(): Promise<CredentialStoreAvailability> {
    try {
      await this.#database
      return 'available'
    } catch {
      return 'unavailable'
    }
  }

  async status(reference: CredentialRef): Promise<CredentialStatus> {
    return (await this.read(reference)) === null ? 'missing' : 'configured'
  }

  async read(reference: CredentialRef): Promise<string | null> {
    const key = credentialKey(reference)
    try {
      const database = await this.#database
      const record = await database.get('credentials', key)
      if (!record) return null

      const masterKey = await this.#masterKey(database)
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: record.iv, additionalData: this.#additionalData(key) },
        masterKey,
        record.ciphertext
      )
      return new TextDecoder().decode(plaintext)
    } catch (error) {
      throw this.#normalizeError(error)
    }
  }

  async write(reference: CredentialRef, value: string): Promise<void> {
    validateCredentialValue(value)
    const key = credentialKey(reference)
    try {
      const database = await this.#database
      const masterKey = await this.#masterKey(database)
      const iv = ownedBuffer(crypto.getRandomValues(new Uint8Array(IV_LENGTH)))
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: this.#additionalData(key) },
        masterKey,
        ownedBuffer(new TextEncoder().encode(value))
      )
      await database.put('credentials', { iv, ciphertext }, key)
    } catch (error) {
      throw this.#normalizeError(error)
    }
  }

  async remove(reference: CredentialRef): Promise<void> {
    try {
      const database = await this.#database
      await database.delete('credentials', credentialKey(reference))
    } catch (error) {
      throw this.#normalizeError(error)
    }
  }

  #masterKey(database: IDBPDatabase<CredentialDatabase>): Promise<CryptoKey> {
    this.#masterKeyPromise ??= this.#loadOrCreateMasterKey(database)
    return this.#masterKeyPromise
  }

  async #loadOrCreateMasterKey(database: IDBPDatabase<CredentialDatabase>): Promise<CryptoKey> {
    const existing = await database.get('metadata', MASTER_KEY_ID)
    if (existing) return existing

    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt'
    ])
    await database.put('metadata', generated, MASTER_KEY_ID)
    return generated
  }

  #additionalData(key: string): ArrayBuffer {
    return ownedBuffer(new TextEncoder().encode(key))
  }

  #normalizeError(error: unknown): CredentialStoreError {
    if (error instanceof CredentialStoreError) return error
    return new CredentialStoreError('failed', 'Browser credential operation failed')
  }
}
