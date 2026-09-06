import { expect, test } from 'bun:test'

import { effectScope, ref } from 'vue'

import { vectorizeProviderID } from '@/app/editor/vectorize'
import { useVectorizeSettings } from '@/app/editor/vectorize/settings/use'

function deferred() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('vectorization save cannot clear a different provider draft', async () => {
  const original = vectorizeProviderID.value
  vectorizeProviderID.value = 'recraft'
  const pending = deferred()
  const scope = effectScope()
  const key = ref('')
  try {
    const state = scope.run(() =>
      useVectorizeSettings(key, {
        status: async () => 'missing',
        set: async () => pending.promise
      })
    )
    if (!state) throw new Error('Missing scope')
    key.value = 'first-key'
    const saving = state.saveCredential()
    vectorizeProviderID.value = 'fal'
    key.value = 'second-key'
    pending.resolve()
    await saving
    expect(key.value).toBe('second-key')
    expect(state.error.value).toBe('')
  } finally {
    scope.stop()
    vectorizeProviderID.value = original
  }
})

test('vectorization save and clear failures preserve the draft and expose errors', async () => {
  const scope = effectScope()
  const key = ref('')
  try {
    const state = scope.run(() =>
      useVectorizeSettings(key, {
        status: async () => 'configured',
        set: async () => {
          throw new Error('Credential store unavailable')
        }
      })
    )
    if (!state) throw new Error('Missing scope')
    key.value = 'replacement'
    await state.saveCredential()
    expect(key.value).toBe('replacement')
    expect(state.error.value).toBe('Credential store unavailable')
    await state.clearCredential()
    expect(key.value).toBe('replacement')
    expect(state.error.value).toBe('Credential store unavailable')
  } finally {
    scope.stop()
  }
})
