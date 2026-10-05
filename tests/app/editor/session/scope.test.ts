import { describe, expect, test } from 'bun:test'

import { getCurrentScope, ref, watch, type EffectScope } from 'vue'

import { scopedStoreFactory } from '@/app/editor/session/scope'

describe('scopedStoreFactory', () => {
  test('stops the store scope on dispose', () => {
    let scope: EffectScope | undefined
    const create = scopedStoreFactory(() => {
      scope = getCurrentScope()
      watch(ref(0), () => {})
      return { dispose() {} }
    })

    create().dispose()

    expect(scope?.active).toBe(false)
  })

  test('stops the store scope when building the store throws', () => {
    let scope: EffectScope | undefined
    const create = scopedStoreFactory((): { dispose(): void } => {
      scope = getCurrentScope()
      watch(ref(0), () => {})
      throw new Error('build failed')
    })

    expect(() => create()).toThrow('build failed')
    expect(scope?.active).toBe(false)
  })
})
