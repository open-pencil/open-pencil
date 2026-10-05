import { tryOnScopeDispose } from '@vueuse/core'
import { reactive } from 'vue'

import { fetchOpenRouterKeyInfo } from '@/app/ai/providers/openrouter/key'
import {
  signInWithOpenRouter,
  type OpenRouterSignIn,
  type OpenRouterSignInFailure,
  type OpenRouterSignInOptions
} from '@/app/ai/providers/openrouter/sign-in'

import type { OnboardingConnectionState } from './connections'
import type { OnboardingAccess } from './plan'

export type OnboardingSignInStatus = 'idle' | 'waiting' | 'verifying' | OpenRouterSignInFailure

interface OnboardingSignInOptions {
  connection: (providerID: OnboardingAccess) => OnboardingConnectionState
  resetTest: (providerID: OnboardingAccess) => void
}

/** Provider sign-in that fills the API key, then tests it like a pasted key. */
export function useOnboardingSignIn({ connection, resetTest }: OnboardingSignInOptions) {
  const statuses = reactive<Partial<Record<OnboardingAccess, OnboardingSignInStatus>>>({})
  const attempts = new Map<
    OnboardingAccess,
    { controller: AbortController; sign: OpenRouterSignIn }
  >()

  tryOnScopeDispose(() => {
    for (const { controller } of attempts.values()) controller.abort()
    attempts.clear()
  })

  function signInStatus(providerID: OnboardingAccess): OnboardingSignInStatus {
    return statuses[providerID] ?? 'idle'
  }

  async function complete(providerID: OnboardingAccess, sign: OpenRouterSignIn): Promise<void> {
    const current = () => attempts.get(providerID)?.sign === sign
    const result = await sign.result
    if (!current()) return
    if (!result.ok) {
      attempts.delete(providerID)
      statuses[providerID] = result.reason
      return
    }
    // The key is checked with OpenRouter directly, which costs nothing and needs no credits.
    statuses[providerID] = 'verifying'
    const account = await fetchOpenRouterKeyInfo(result.key).catch(() => null)
    if (!current()) return
    attempts.delete(providerID)
    if (!account) {
      statuses[providerID] = 'failed'
      return
    }
    resetTest(providerID)
    Object.assign(connection(providerID), { apiKey: result.key, account })
    statuses[providerID] = 'idle'
  }

  /** Forgets a signed-in key so another account can sign in or a key can be pasted. */
  function signOut(providerID: OnboardingAccess): void {
    cancelSignIn(providerID)
    Object.assign(connection(providerID), { apiKey: '', account: null })
    resetTest(providerID)
    statuses[providerID] = 'idle'
  }

  /** Call directly from the click that starts sign-in, so the browser allows its popup. */
  function signIn(
    providerID: OnboardingAccess,
    labels: Pick<OpenRouterSignInOptions, 'keyLabel'>
  ): void {
    if (providerID !== 'openrouter') return
    attempts.get(providerID)?.controller.abort()
    const controller = new AbortController()
    const sign = signInWithOpenRouter({ ...labels, signal: controller.signal })
    attempts.set(providerID, { controller, sign })
    statuses[providerID] = 'waiting'
    void complete(providerID, sign)
  }

  function reopenSignIn(providerID: OnboardingAccess): void {
    attempts.get(providerID)?.sign.reopen()
  }

  /** Stops an attempt, including one whose key is still being checked. */
  function cancelSignIn(providerID: OnboardingAccess): void {
    attempts.get(providerID)?.controller.abort()
    attempts.delete(providerID)
    statuses[providerID] = 'idle'
  }

  return { signInStatus, signIn, reopenSignIn, cancelSignIn, signOut }
}
