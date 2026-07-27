import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { openDB } from 'idb'

import { BrowserCredentialStore } from '@/app/settings/credentials/browser'
import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import { credentialKey, credentialRef } from '@/app/settings/credentials/reference'
import { createCredentialServices } from '@/app/settings/credentials/services'
import { SwitchableCredentialStore } from '@/app/settings/credentials/switchable'
import type {
  CredentialBackend,
  CredentialRef,
  CredentialStatus,
  CredentialStore,
  CredentialStoreAvailability
} from '@/app/settings/credentials/types'

const API_KEY = credentialRef('openai-compatible', 'api-key')
const MEDIA_KEY = credentialRef('pexels', 'api-key')

class TestCredentialStore implements CredentialStore {
  readonly #values = new Map<string, string>()
  failWriteFor?: string
  failRemoveFor?: string

  constructor(readonly backend: CredentialBackend) {}

  availability(): Promise<CredentialStoreAvailability> {
    return Promise.resolve('available')
  }

  status(reference: CredentialRef): Promise<CredentialStatus> {
    return Promise.resolve(this.#values.has(credentialKey(reference)) ? 'configured' : 'missing')
  }

  read(reference: CredentialRef): Promise<string | null> {
    return Promise.resolve(this.#values.get(credentialKey(reference)) ?? null)
  }

  write(reference: CredentialRef, value: string): Promise<void> {
    const key = credentialKey(reference)
    if (key === this.failWriteFor) return Promise.reject(new Error('write failed'))
    this.#values.set(key, value)
    return Promise.resolve()
  }

  remove(reference: CredentialRef): Promise<void> {
    const key = credentialKey(reference)
    if (key === this.failRemoveFor) return Promise.reject(new Error('remove failed'))
    this.#values.delete(key)
    return Promise.resolve()
  }
}

describe('credential references', () => {
  test('creates stable versioned keys', () => {
    expect(credentialKey(API_KEY)).toBe('v1:openai-compatible:default:api-key')
  })

  test('rejects account-path injection', () => {
    expect(() => credentialRef('../../other-app', 'api-key')).toThrow(
      'Credential reference is invalid'
    )
  })
})

describe('credential service roles', () => {
  test('settings can manage status without receiving read access', async () => {
    const { manager, resolver } = createCredentialServices(new MemoryCredentialStore())

    expect('resolve' in manager).toBeFalse()
    expect(await manager.status(API_KEY)).toBe('missing')
    await expect(manager.set(API_KEY, '')).rejects.toThrow('Credential value is invalid')
    await manager.set(API_KEY, 'secret')
    expect(await manager.status(API_KEY)).toBe('configured')
    expect(await resolver.resolve(API_KEY)).toBe('secret')
    await manager.clear(API_KEY)
    expect(await resolver.resolve(API_KEY)).toBeNull()
  })

  test('switches persistence without changing service consumers', async () => {
    const store = new SwitchableCredentialStore(new MemoryCredentialStore())
    const { manager, resolver } = createCredentialServices(store)
    await manager.set(API_KEY, 'move-me')

    await store.switchTo(new BrowserCredentialStore(), [API_KEY])

    expect(manager.backend).toBe('browser')
    expect(await resolver.resolve(API_KEY)).toBe('move-me')
    await manager.clear(API_KEY)
  })

  test('keeps the previous backend active when copying fails', async () => {
    const previous = new TestCredentialStore('memory')
    const next = new TestCredentialStore('browser')
    next.failWriteFor = credentialKey(MEDIA_KEY)
    await previous.write(API_KEY, 'ai-secret')
    await previous.write(MEDIA_KEY, 'media-secret')
    const store = new SwitchableCredentialStore(previous)

    await expect(store.switchTo(next, [API_KEY, MEDIA_KEY])).rejects.toThrow('write failed')

    expect(store.backend).toBe('memory')
    expect(await store.read(API_KEY)).toBe('ai-secret')
    expect(await store.read(MEDIA_KEY)).toBe('media-secret')
    expect(await next.read(API_KEY)).toBeNull()
  })

  test('restores the previous backend when persistent cleanup fails', async () => {
    const previous = new TestCredentialStore('browser')
    const next = new TestCredentialStore('memory')
    previous.failRemoveFor = credentialKey(MEDIA_KEY)
    await previous.write(API_KEY, 'ai-secret')
    await previous.write(MEDIA_KEY, 'media-secret')
    const store = new SwitchableCredentialStore(previous)

    await expect(
      store.switchTo(next, [API_KEY, MEDIA_KEY], { clearPrevious: true })
    ).rejects.toThrow('remove failed')

    expect(store.backend).toBe('browser')
    expect(await store.read(API_KEY)).toBe('ai-secret')
    expect(await store.read(MEDIA_KEY)).toBe('media-secret')
    expect(await next.read(API_KEY)).toBeNull()
    expect(await next.read(MEDIA_KEY)).toBeNull()
  })
})

describe('browser credential store', () => {
  test('encrypts remembered credentials in IndexedDB', async () => {
    const store = new BrowserCredentialStore()

    expect(await store.availability()).toBe('available')
    await store.write(API_KEY, 'browser-secret')
    expect(await store.read(API_KEY)).toBe('browser-secret')

    const database = await openDB('open-pencil-credentials', 1)
    const record = await database.get('credentials', credentialKey(API_KEY))
    expect(record).toBeDefined()
    expect(JSON.stringify(record)).not.toContain('browser-secret')
    database.close()

    await store.remove(API_KEY)
    expect(await store.status(API_KEY)).toBe('missing')
  })
})
