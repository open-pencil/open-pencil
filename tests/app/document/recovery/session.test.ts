import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  endRecoverySession,
  recoverySessionId,
  sessionStates,
  startRecoverySession
} from '@/app/document/recovery/session'
import {
  setSessionRegistryForTests,
  startedSessionIds
} from '@/app/document/recovery/session/storage'

/** The session registry as local storage keeps it; Bun has no local storage. */
function memoryRegistry() {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => [...items.keys()][index] ?? null,
    removeItem: (key: string) => void items.delete(key),
    setItem: (key: string, value: string) => void items.set(key, value)
  }
}

describe('recovery sessions', () => {
  beforeAll(() => setSessionRegistryForTests(memoryRegistry()))
  afterAll(() => setSessionRegistryForTests(undefined))

  test('a started session whose lock is gone crashed', () => {
    const states = sessionStates(['crashed', 'other-window'], ['other-window'])
    expect([...states.crashed]).toEqual(['crashed'])
    expect(states.live).toEqual(new Set([recoverySessionId, 'other-window']))
  })

  test('a session that ended on purpose is no longer started, so it is not a crash', () => {
    expect(sessionStates([], []).crashed.size).toBe(0)
  })

  test('without Web Locks no session crashed and only this one runs', () => {
    const states = sessionStates(['other-or-crashed'], null)
    expect(states.crashed.size).toBe(0)
    expect(states.live).toEqual(new Set([recoverySessionId]))
  })

  test('a session counts as started only once its lock is held, until it ends', () => {
    const pending: { grant?: () => unknown } = {}
    const locks = {
      query: async () => ({ held: [], pending: [] }),
      request: ((_name: string, callback: () => unknown) => {
        pending.grant = callback
        return Promise.resolve()
      }) as LockManager['request']
    }
    startRecoverySession(locks)
    // Before the grant no window could tell it from a crashed one, so it is not listed yet.
    expect(startedSessionIds()).toEqual([])
    void pending.grant?.()
    expect(startedSessionIds()).toEqual([recoverySessionId])
    endRecoverySession()
    expect(startedSessionIds()).toEqual([])
  })
})
