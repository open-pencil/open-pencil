import { encode } from 'js-base64'

import type { ChatGPTCredential } from '@/app/ai/providers/chatgpt/credential'

const AUTH_CLAIM = 'https://api.openai.com/auth'

/** An unsigned JWT; the app reads its own token responses without verifying them. */
export function jwt(payload: Record<string, unknown>): string {
  return `${encode('{"alg":"none"}', true)}.${encode(JSON.stringify(payload), true)}.sig`
}

export const accessToken = jwt({ [AUTH_CLAIM]: { chatgpt_account_id: 'acct-1' } })
export const idToken = jwt({
  email: 'person@example.com',
  [AUTH_CLAIM]: { chatgpt_plan_type: 'plus' }
})

export function credential(patch: Partial<ChatGPTCredential> = {}): ChatGPTCredential {
  return {
    access: 'access-1',
    refresh: 'refresh-1',
    expires: Date.now() + 60 * 60 * 1000,
    accountId: 'acct-1',
    email: 'person@example.com',
    plan: 'plus',
    ...patch
  }
}

export function tokenResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}
