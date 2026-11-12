import { tryOnScopeDispose } from '@vueuse/core'
import { reactive } from 'vue'

import {
  parseChatGPTCredential,
  serializeChatGPTCredential
} from '@/app/ai/providers/chatgpt/credential'
import { signInWithChatGPT, type ChatGPTSignInFailure } from '@/app/ai/providers/chatgpt/sign-in'
import { fetchOpenRouterKeyInfo } from '@/app/ai/providers/openrouter/key'
import {
  signInWithOpenRouter,
  type OpenRouterSignInFailure,
  type OpenRouterSignInOptions
} from '@/app/ai/providers/openrouter/sign-in'
import type { SignIn } from '@/app/ai/providers/sign-in/attempt'

import type { OnboardingAccount, OnboardingConnectionState } from './connections'
import type { OnboardingAccess } from './plan'

type SignInFailure = OpenRouterSignInFailure | ChatGPTSignInFailure
export type OnboardingSignInStatus = 'idle' | 'waiting' | 'verifying' | SignInFailure
export type OnboardingSignInLabels = Pick<OpenRouterSignInOptions, 'keyLabel'>

/** An attempt that ends with the credential to save as the connection's key. */
type CredentialSignIn = SignIn<string, 'blocked' | 'port-in-use'>

interface SignInProvider {
  start: (signal: AbortSignal, labels: OnboardingSignInLabels) => CredentialSignIn
  /** Confirms the credential works and reads the account it belongs to. */
  verify: (key: string) => Promise<OnboardingAccount | null>
}

/** Providers setup can sign in to instead of asking for a key. */
export type OnboardingSignInProvider = 'openrouter' | 'chatgpt'

const SIGN_IN_PROVIDERS: Record<OnboardingSignInProvider, SignInProvider> = {
  openrouter: {
    start: (signal, labels) => signInWithOpenRouter({ ...labels, signal }),
    // The key is checked with OpenRouter directly, which costs nothing and needs no credits.
    verify: async (key) => {
      const info = await fetchOpenRouterKeyInfo(key).catch(() => null)
      return info && { provider: 'openrouter', ...info }
    }
  },
  chatgpt: {
    start: (signal) => {
      const sign = signInWithChatGPT(signal)
      return {
        reopen: sign.reopen,
        result: sign.result.then((result) =>
          result.ok ? { ok: true, value: serializeChatGPTCredential(result.value) } : result
        )
      }
    },
    // The token endpoint already accepted the sign-in; the account is in its tokens.
    verify: async (key) => {
      const credential = parseChatGPTCredential(key)
      return credential && { provider: 'chatgpt', email: credential.email, plan: credential.plan }
    }
  }
}

export function isOnboardingSignInProvider(
  providerID: OnboardingAccess
): providerID is OnboardingSignInProvider {
  return Object.hasOwn(SIGN_IN_PROVIDERS, providerID)
}

interface OnboardingSignInOptions {
  connection: (providerID: OnboardingAccess) => OnboardingConnectionState
  resetTest: (providerID: OnboardingAccess) => void
}

/** Provider sign-in that fills the API key, then tests it like a pasted key. */
export function useOnboardingSignIn({ connection, resetTest }: OnboardingSignInOptions) {
  const statuses = reactive<Partial<Record<OnboardingAccess, OnboardingSignInStatus>>>({})
  const attempts = new Map<
    OnboardingAccess,
    { controller: AbortController; sign: CredentialSignIn }
  >()

  tryOnScopeDispose(() => {
    for (const { controller } of attempts.values()) controller.abort()
    attempts.clear()
  })

  function signInStatus(providerID: OnboardingAccess): OnboardingSignInStatus {
    return statuses[providerID] ?? 'idle'
  }

  async function complete(
    providerID: OnboardingAccess,
    provider: SignInProvider,
    sign: CredentialSignIn
  ): Promise<void> {
    const current = () => attempts.get(providerID)?.sign === sign
    const result = await sign.result
    if (!current()) return
    if (!result.ok) {
      attempts.delete(providerID)
      statuses[providerID] = result.reason
      return
    }
    statuses[providerID] = 'verifying'
    const account = await provider.verify(result.value)
    if (!current()) return
    attempts.delete(providerID)
    if (!account) {
      statuses[providerID] = 'failed'
      return
    }
    resetTest(providerID)
    Object.assign(connection(providerID), { apiKey: result.value, account })
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
  function signIn(providerID: OnboardingAccess, labels: OnboardingSignInLabels): void {
    if (!isOnboardingSignInProvider(providerID)) return
    const provider = SIGN_IN_PROVIDERS[providerID]
    attempts.get(providerID)?.controller.abort()
    const controller = new AbortController()
    const sign = provider.start(controller.signal, labels)
    attempts.set(providerID, { controller, sign })
    statuses[providerID] = 'waiting'
    void complete(providerID, provider, sign)
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
