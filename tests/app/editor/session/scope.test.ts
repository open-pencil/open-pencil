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

  test('runs a later effect in the store scope until the store disposes', () => {
    const create = scopedStoreFactory(() => ({ dispose: () => undefined }))
    const store = create()
    let ran: EffectScope | undefined

    expect(store.runInScope(() => (ran = getCurrentScope()))).toBe(ran)
    expect(ran?.active).toBe(true)

    store.dispose()
    expect(ran?.active).toBe(false)
    expect(store.runInScope(() => 'late')).toBeUndefined()
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
