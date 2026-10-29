import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, type Ref } from 'vue'

import {
  parseChatGPTCredential,
  serializeChatGPTCredential
} from '@/app/ai/providers/chatgpt/credential'
import {
  signInWithChatGPT,
  type ChatGPTSignIn,
  type ChatGPTSignInFailure
} from '@/app/ai/providers/chatgpt/sign-in'

export type ProfileSignInStatus = 'idle' | 'waiting' | ChatGPTSignInFailure

/**
 * Signing in for a provider that takes no pasted key. The credential lands in the key input,
 * so saving the profile stores it like a key.
 */
export function useProfileSignIn(keyInput: Ref<string>) {
  const status = ref<ProfileSignInStatus>('idle')
  let attempt: { controller: AbortController; sign: ChatGPTSignIn } | null = null

  /** The account signed in to during this edit; a saved sign-in is not read back. */
  const email = computed(() => parseChatGPTCredential(keyInput.value)?.email)
  const signedIn = computed(() => parseChatGPTCredential(keyInput.value) !== null)

  function cancel(): void {
    attempt?.controller.abort()
    attempt = null
    status.value = 'idle'
  }

  async function signIn(): Promise<void> {
    cancel()
    const controller = new AbortController()
    const sign = signInWithChatGPT(controller.signal)
    attempt = { controller, sign }
    const current = () => attempt?.sign === sign
    status.value = 'waiting'
    const result = await sign.result
    if (!current()) return
    attempt = null
    if (!result.ok) {
      status.value = result.reason
      return
    }
    keyInput.value = serializeChatGPTCredential(result.value)
    status.value = 'idle'
  }

  function reopen(): void {
    attempt?.sign.reopen()
  }

  tryOnScopeDispose(cancel)

  return { status, email, signedIn, signIn, reopen, cancel }
}
