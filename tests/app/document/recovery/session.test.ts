import { describe, expect, test } from 'bun:test'

import {
  endRecoverySession,
  recoverySessionId,
  recoverySessionStates,
  sessionStates,
  startRecoverySession
} from '@/app/document/recovery/session'

describe('recovery sessions', () => {
  test('a started session whose lock is gone crashed', () => {
    const states = sessionStates(['crashed', 'other-window'], ['other-window'])
    expect([...states.crashed]).toEqual(['crashed'])
    expect(states.live).toEqual(new Set([recoverySessionId, 'other-window']))
  })

  test('a session that ended on purpose is no longer started, so it is not a crash', () => {
    expect(sessionStates([], []).crashed.size).toBe(0)
  })

  test('without Web Locks every started session counts as running', () => {
    const states = sessionStates(['maybe-crashed'], null)
    expect(states.crashed.size).toBe(0)
    expect(states.live.has('maybe-crashed')).toBe(true)
  })

  test('this session is running from its start until it ends', async () => {
    const locks = {
      query: async () => ({ held: [], pending: [] }),
      request: async () => undefined
    }
    startRecoverySession(locks)
    expect((await recoverySessionStates(locks)).crashed.has(recoverySessionId)).toBe(false)
    endRecoverySession()
  })
})
