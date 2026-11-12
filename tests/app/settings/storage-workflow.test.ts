import { expect, test } from 'bun:test'

import { effectScope, ref } from 'vue'

import { useStorageSettings } from '@/app/integrations/storage/settings/use'
import type { CredentialManager } from '@/app/settings/credentials/types'

function fixture() {
  const preferences = ref<Record<string, string>>({
    endpoint: 'https://old.example.com',
    bucket: 'designs',
    region: 'auto'
  })
  const writes: string[] = []
  const tests: Record<string, string>[] = []
  const changed: string[] = []
  const manager: CredentialManager = {
    backend: 'memory',
    availability: async () => 'available',
    status: async () => 'configured',
    set: async (reference) => {
      writes.push(`set:${reference.field}`)
    },
    clear: async (reference) => {
      writes.push(`clear:${reference.field}`)
    }
  }
  return {
    preferences,
    writes,
    tests,
    changed,
    services: {
      readPreferences: () => ({ ...preferences.value }),
      writePreference: (_provider: string, field: string, value: string) => {
        preferences.value = { ...preferences.value, [field]: value }
        writes.push(`preference:${field}`)
      },
      statuses: async () => ({
        'access-key-id': 'configured' as const,
        'secret-access-key': 'configured' as const
      }),
      manager,
      test: async (_provider: string, values: Record<string, string>) => {
        tests.push(values)
        return { ok: true, message: 'Connected' }
      },
      resume: async () => undefined,
      changed: (provider: string) => {
        changed.push(provider)
      }
    }
  }
}

test('testing storage drafts and cancelling never persist settings', async () => {
  const f = fixture()
  const scope = effectScope()
  const credentials = ref<Record<string, string>>({})
  try {
    const state = scope.run(() => useStorageSettings(credentials, f.services))
    if (!state) throw new Error('Missing scope')
    state.preferenceDrafts.value.endpoint = 'https://draft.example.com'
    credentials.value['secret-access-key'] = 'test-only-draft'
    expect(state.dirty.value).toBe(true)
    expect(await state.testConnection()).toEqual({ ok: true, message: 'Connected' })
    expect(f.tests[0]?.endpoint).toBe('https://draft.example.com')
    expect(f.writes).toEqual([])
    expect(f.changed).toEqual([])
    expect(f.preferences.value.endpoint).toBe('https://old.example.com')
    state.cancel()
    expect(state.dirty.value).toBe(false)
    expect(credentials.value).toEqual({})
    expect(state.preferenceDrafts.value.endpoint).toBe('https://old.example.com')
  } finally {
    scope.stop()
  }
})

test('credential clearing is staged until Save', async () => {
  const f = fixture()
  const scope = effectScope()
  try {
    const state = scope.run(() => useStorageSettings(ref({}), f.services))
    if (!state) throw new Error('Missing scope')
    state.clearCredential('secret-access-key')
    expect(f.writes).toEqual([])
    expect(state.dirty.value).toBe(true)
    expect(await state.save()).toBe('saved')
    expect(f.writes).toContain('clear:secret-access-key')
    expect(f.changed).toEqual(['s3-compatible'])
    expect(state.dirty.value).toBe(false)
  } finally {
    scope.stop()
  }
})

test('failure before any storage write is not reported as a partial save', async () => {
  const f = fixture()
  f.services.writePreference = () => {
    throw new Error('Preferences unavailable')
  }
  const scope = effectScope()
  try {
    const state = scope.run(() => useStorageSettings(ref({}), f.services))
    if (!state) throw new Error('Missing scope')
    expect(await state.save()).toBe('failed')
    expect(state.saveResult.value).toBe('failed')
    expect(f.writes).toEqual([])
    expect(f.changed).toEqual([])
  } finally {
    scope.stop()
  }
})

test('failed storage saves retain replacement drafts and expose the failure', async () => {
  const f = fixture()
  f.services.manager.set = async () => {
    throw new Error('Credential store locked')
  }
  const scope = effectScope()
  const credentials = ref<Record<string, string>>({})
  try {
    const state = scope.run(() => useStorageSettings(credentials, f.services))
    if (!state) throw new Error('Missing scope')
    credentials.value['secret-access-key'] = 'test-only-replacement'
    expect(await state.save()).toBe('partial')
    expect(state.saveResult.value).toBe('partial')
    expect(state.error.value).toBe('Credential store locked')
    expect(f.changed).toEqual(['s3-compatible'])
    expect(state.busy.value).toBe(false)
    expect(credentials.value['secret-access-key']).toBe('test-only-replacement')
    scope.stop()
    expect(credentials.value).toEqual({})
  } finally {
    scope.stop()
  }
})
