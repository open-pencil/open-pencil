import { describe, expect, test } from 'bun:test'

import { getCurrentScope, type EffectScope } from 'vue'

import { scopedStoreFactory } from '@/app/editor/session/scope'

describe('scopedStoreFactory', () => {
  test('stops the store scope after the store disposes', () => {
    let scope: EffectScope | undefined
    let disposed = 0
    const create = scopedStoreFactory(() => {
      scope = getCurrentScope()
      return { dispose: () => disposed++ }
    })

    create().dispose()

    expect(disposed).toBe(1)
    expect(scope?.active).toBe(false)
  })

  test('stops the store scope when building the store throws', () => {
    let scope: EffectScope | undefined
    const create = scopedStoreFactory((): { dispose(): void } => {
      scope = getCurrentScope()
      throw new Error('build failed')
    })

    expect(() => create()).toThrow('build failed')
    expect(scope?.active).toBe(false)
  })
})
