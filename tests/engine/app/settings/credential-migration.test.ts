import { describe, expect, test } from 'bun:test'

import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import {
  hasLegacyCredential,
  initializeCredentialMigration,
  migrateLegacyCredentials,
  PEXELS_CREDENTIAL,
  providerCredentialRef
} from '@/app/settings/credentials/migration'

class TestStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}

class UnavailableCredentialStore extends MemoryCredentialStore {
  override async availability() {
    return 'unavailable' as const
  }
}

class CountingStorage extends TestStorage {
  scans = 0

  override key(index: number): string | null {
    this.scans++
    return super.key(index)
  }
}

describe('legacy credential migration', () => {
  test('recognizes pending credentials without migrating or removing them', () => {
    const storage = new TestStorage()
    storage.setItem('open-pencil:ai-key:openrouter', 'pending-key')
    expect(hasLegacyCredential(providerCredentialRef('openrouter'), storage)).toBe(true)
    expect(hasLegacyCredential(providerCredentialRef('anthropic'), storage)).toBe(false)
    expect(
      hasLegacyCredential(providerCredentialRef('openrouter', 'another-profile'), storage)
    ).toBe(false)
    expect(storage.getItem('open-pencil:ai-key:openrouter')).toBe('pending-key')
    storage.setItem('open-pencil:credential-migration', '1')
    expect(hasLegacyCredential(providerCredentialRef('openrouter'), storage)).toBe(false)
  })

  test('concurrent migrations share one in-flight run', async () => {
    const storage = new CountingStorage()
    storage.setItem('open-pencil:pexels-api-key', 'legacy-pexels-key')

    await Promise.all([
      initializeCredentialMigration(storage),
      initializeCredentialMigration(storage)
    ])

    expect(storage.scans).toBe(storage.length)
    expect(storage.getItem('open-pencil:pexels-api-key')).toBeNull()
  })

  test('concurrent migrations of distinct sources both complete', async () => {
    const mediaStorage = new TestStorage()
    const providerStorage = new TestStorage()
    mediaStorage.setItem('open-pencil:pexels-api-key', 'legacy-pexels-key')
    providerStorage.setItem('open-pencil:ai-key:anthropic', 'legacy-anthropic-key')

    const results = await Promise.all([
      initializeCredentialMigration(mediaStorage),
      initializeCredentialMigration(providerStorage)
    ])

    expect(results).toEqual([true, true])
    expect(mediaStorage.getItem('open-pencil:pexels-api-key')).toBeNull()
    expect(providerStorage.getItem('open-pencil:ai-key:anthropic')).toBeNull()
  })

  test('verifies encrypted destinations before removing plaintext keys', async () => {
    const storage = new TestStorage()
    const store = new MemoryCredentialStore()
    storage.setItem('open-pencil:openrouter-api-key', 'old-openrouter-key')
    storage.setItem('open-pencil:ai-key:anthropic', 'anthropic-key')
    storage.setItem('open-pencil:pexels-api-key', 'pexels-key')

    expect(await migrateLegacyCredentials(storage, store)).toBeTrue()
    expect(await store.read(providerCredentialRef('openrouter'))).toBe('old-openrouter-key')
    expect(await store.read(providerCredentialRef('anthropic'))).toBe('anthropic-key')
    expect(await store.read(PEXELS_CREDENTIAL)).toBe('pexels-key')
    expect(storage.getItem('open-pencil:openrouter-api-key')).toBeNull()
    expect(storage.getItem('open-pencil:ai-key:anthropic')).toBeNull()
    expect(storage.getItem('open-pencil:pexels-api-key')).toBeNull()
  })

  test('retains plaintext when the destination is unavailable', async () => {
    const storage = new TestStorage()
    storage.setItem('open-pencil:ai-key:openrouter', 'keep-me')

    expect(await migrateLegacyCredentials(storage, new UnavailableCredentialStore())).toBeFalse()
    expect(storage.getItem('open-pencil:ai-key:openrouter')).toBe('keep-me')
  })

  test('clearing after migration removes a legacy-only credential for good', async () => {
    const storage = new TestStorage()
    const store = new MemoryCredentialStore()
    storage.setItem('open-pencil:pexels-api-key', 'legacy-pexels-key')

    expect(await migrateLegacyCredentials(storage, store)).toBeTrue()
    await store.remove(PEXELS_CREDENTIAL)

    expect(hasLegacyCredential(PEXELS_CREDENTIAL, storage)).toBeFalse()
    expect(await store.read(PEXELS_CREDENTIAL)).toBeNull()
  })
})
