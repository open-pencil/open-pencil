import { createOpenAI } from '@ai-sdk/openai'
import { defaultSettingsMiddleware, wrapLanguageModel } from 'ai'

import { randomHex } from '@open-pencil/scene-graph/random'

import type { ModelCredentialStore, ModelProviderAdapter } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'

import {
  parseChatGPTCredential,
  serializeChatGPTCredential,
  type ChatGPTCredential
} from './credential'
import { CHATGPT_CODEX_BASE_URL, ChatGPTSignInExpiredError, createCodexFetch } from './fetch'

/** A fetch signed by a stored ChatGPT sign-in, which keeps the tokens it refreshes. */
export function chatGPTFetch(
  credential: ChatGPTCredential,
  store?: ModelCredentialStore,
  fetchImpl?: FetchFunction,
  promptCacheKey?: string
): FetchFunction {
  return createCodexFetch({
    credential,
    fetch: fetchImpl,
    promptCacheKey,
    load: store && (async () => parseChatGPTCredential((await store.load()) ?? '')),
    save: store && ((next) => store.save(serializeChatGPTCredential(next)))
  })
}

/** ChatGPT accounts reach their models through the Codex backend's Responses API. */
export const chatGPTAdapter: ModelProviderAdapter = {
  create(config, runtime) {
    const credential = parseChatGPTCredential(config.apiKey)
    if (!credential) throw new ChatGPTSignInExpiredError()
    const provider = createOpenAI({
      // The signed fetch replaces this with the account's access token.
      apiKey: 'chatgpt',
      baseURL: CHATGPT_CODEX_BASE_URL,
      fetch: chatGPTFetch(credential, runtime.credentials, runtime.fetch, randomHex(16))
    })
    // The backend keeps nothing, so earlier replies must be sent whole: with `store` off the AI
    // SDK sends their items and encrypted reasoning instead of references to stored ones.
    return wrapLanguageModel({
      model: provider.responses(config.modelID),
      middleware: defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            openai: { store: false, include: ['reasoning.encrypted_content'] }
          }
        }
      })
    })
  }
}
