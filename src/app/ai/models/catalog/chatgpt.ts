import type { ModelOption } from '@open-pencil/core/constants'

import {
  modelConnectionCredentialStore,
  resolveModelConnectionAPIKey
} from '@/app/ai/models/runtime'
import { aiModelSettings } from '@/app/ai/models/store'
import { chatGPTFetch } from '@/app/ai/providers/chatgpt/adapter'
import { fetchChatGPTModels } from '@/app/ai/providers/chatgpt/catalog'
import { parseChatGPTCredential } from '@/app/ai/providers/chatgpt/credential'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

/** The models of the first ChatGPT sign-in, or null before anyone has signed in. */
export async function listChatGPTModels(): Promise<ModelOption[] | null> {
  for (const connection of aiModelSettings.value.connections) {
    if (connection.providerID !== 'chatgpt') continue
    const credential = parseChatGPTCredential(
      (await resolveModelConnectionAPIKey(connection.id)) ?? ''
    )
    if (!credential) continue
    const store = modelConnectionCredentialStore(connection.id)
    const signed = chatGPTFetch(credential, store, isTauri() ? tauriFetch : undefined)
    return fetchChatGPTModels(signed).catch(() => null)
  }
  return null
}
