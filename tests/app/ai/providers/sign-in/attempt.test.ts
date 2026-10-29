import { describe, expect, test } from 'bun:test'

import {
  callbackOutcome,
  startSignIn,
  type CallbackOutcome,
  type SignInCallback,
  type SignInFlow
} from '@/app/ai/providers/sign-in/attempt'
import { pkceChallenge } from '@/app/ai/providers/sign-in/pkce'
import { createDeferred } from '@/app/runtime/deferred'

interface FakeCallback extends SignInCallback {
  state: string
  opened: string[]
  /** Settles when the page first opens. */
  shown: Promise<undefined>
  closed: number
  redirect: (outcome: CallbackOutcome) => void
}

function fakeCallback(state: string): FakeCallback {
  const outcome = createDeferred<CallbackOutcome>()
  const shown = createDeferred<undefined>()
  const callback: FakeCallback = {
    state,
    opened: [],
    shown: shown.promise,
    closed: 0,
    redirect: outcome.resolve,
    open: (url) => {
      callback.opened.push(url)
      shown.resolve(undefined)
    },
    wait: () => outcome.promise,
    close: () => {
      callback.closed++
    }
  }
  return callback
}

/** A flow whose redirect the test drives; the exchange echoes the code and verifier. */
function fakeFlow(
  overrides: Partial<SignInFlow<string, 'busy'>> = {}
): SignInFlow<string, 'busy'> & { callbacks: FakeCallback[] } {
  const callbacks: FakeCallback[] = []
  return {
    signal: new AbortController().signal,
    callback: async (state) => {
      const callback = fakeCallback(state)
      callbacks.push(callback)
      return callback
    },
    authorizationURL: (pkce) =>
      `https://auth.example/?challenge=${pkce.challenge}&state=${pkce.state}`,
    exchange: async (code, verifier) => `${code}:${verifier}`,
    callbacks,
    ...overrides
  }
}

async function opened(flow: { callbacks: FakeCallback[] }): Promise<FakeCallback> {
  const [callback] = flow.callbacks
  await callback.shown
  return callback
}

describe('provider sign-in', () => {
  test('derives the S256 challenge from the RFC 7636 example verifier', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  test('accepts only the redirect for the current attempt', () => {
    expect(callbackOutcome('?code=abc&state=s1', 's1')).toEqual({ kind: 'code', code: 'abc' })
    expect(callbackOutcome('?code=abc&state=other', 's1')).toEqual({ kind: 'mismatch' })
    expect(callbackOutcome('?error=access_denied&state=s1', 's1')).toEqual({ kind: 'denied' })
  })

  test('opens the page for the callback state, trades the code, and closes the callback', async () => {
    const flow = fakeFlow()
    const sign = startSignIn(flow)
    const callback = await opened(flow)
    const url = new URL(callback.opened[0])
    expect(url.searchParams.get('state')).toBe(callback.state)

    callback.redirect({ kind: 'code', code: 'abc' })
    const result = await sign.result
    expect(result.ok && result.value.startsWith('abc:')).toBe(true)
    expect(callback.closed).toBe(1)
  })

  test('reopens the same page', async () => {
    const flow = fakeFlow()
    const sign = startSignIn(flow)
    const callback = await opened(flow)
    sign.reopen()
    expect(callback.opened).toEqual([callback.opened[0], callback.opened[0]])
    callback.redirect({ kind: 'denied' })
    await sign.result
  })

  test('maps a redirect without a code to a failure', async () => {
    for (const [kind, reason] of [
      ['denied', 'cancelled'],
      ['mismatch', 'failed'],
      ['expired', 'expired']
    ] as const) {
      const flow = fakeFlow()
      const sign = startSignIn(flow)
      ;(await opened(flow)).redirect({ kind })
      expect(await sign.result).toEqual({ ok: false, reason })
    }
  })

  test('closes the callback the moment the attempt is cancelled', async () => {
    const controller = new AbortController()
    const flow = fakeFlow({ signal: controller.signal })
    const sign = startSignIn(flow)
    const callback = await opened(flow)
    controller.abort()
    expect(callback.closed).toBe(1)
    expect(await sign.result).toEqual({ ok: false, reason: 'cancelled' })
    expect(callback.closed).toBe(1)
  })

  test('reports a provider failure from readying the callback', async () => {
    const sign = startSignIn(fakeFlow({ callback: async () => ({ failure: 'busy' }) }))
    expect(await sign.result).toEqual({ ok: false, reason: 'busy' })
  })

  test('reports a failed exchange and still closes the callback', async () => {
    const flow = fakeFlow({
      exchange: async () => {
        throw new Error('rejected')
      }
    })
    const sign = startSignIn(flow)
    const callback = await opened(flow)
    callback.redirect({ kind: 'code', code: 'abc' })
    expect(await sign.result).toEqual({ ok: false, reason: 'failed' })
    expect(callback.closed).toBe(1)
  })
})
