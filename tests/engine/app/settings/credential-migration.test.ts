import { describe, expect, test } from 'bun:test'

import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import {
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

describe('legacy credential migration', () => {
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
})
