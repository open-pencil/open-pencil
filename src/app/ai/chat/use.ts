import { useEventListener } from '@vueuse/core'

import { IS_BROWSER } from '@open-pencil/core/constants'

import { resumingAgent } from '@/app/ai/agents/acp/session'
import { createConversationHistory } from '@/app/ai/chat/history/controller'
import { propertiesTab } from '@/app/ai/chat/panel'
import { createChatSessionManager } from '@/app/ai/chat/session'
import {
  apiKeyStatus,
  browserCredentialsRemembered,
  credentialsReady,
  customAPIType,
  customBaseURL,
  customModelID,
  isACPProvider,
  isHarnessProvider,
  isConfigured,
  maxOutputTokens,
  modelID,
  providerDef,
  providerID,
  registerAIChatEffects,
  resolveAPIKey,
  setAPIKey
} from '@/app/ai/chat/storage'
import { designModelProfile } from '@/app/ai/models'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'
import {
  pexelsKeyStatus,
  unsplashKeyStatus,
  setPexelsKey,
  setUnsplashKey,
  setRememberCredentials
} from '@/app/settings/credentials/media'

const chatSession = createChatSessionManager({
  isConfigured,
  isACPProvider,
  isHarnessProvider,
  providerID,
  credentialsReady,
  getActiveEditorStore
})

const history = createConversationHistory({
  profileId: () => designModelProfile.value?.id ?? null,
  getEditor: getActiveEditorStore,
  ensureChat: chatSession.ensureChat,
  resetChat: chatSession.resetChat,
  backend: () => {
    if (isACPProvider.value) return 'acp'
    return isHarnessProvider.value ? 'harness' : 'direct'
  },
  resumingAgent: () => resumingAgent(providerID.value)
})

registerAIChatEffects(chatSession.markTransportDirty)

// Stop the reply and save the conversation before the page goes. Vite awaits its listeners before
// a development reload; `pagehide` cannot wait, so other reloads save what they can.
if (import.meta.hot) {
  /* eslint-disable typescript-eslint/no-misused-promises -- Vite's client awaits custom event listeners (vite/dist/client/client.mjs, notifyListeners). */
  import.meta.hot.on('vite:beforeFullReload', history.dispose)
  import.meta.hot.on('vite:ws:disconnect', history.dispose)
  /* eslint-enable typescript-eslint/no-misused-promises */
}
if (IS_BROWSER) {
  useEventListener(window, 'pagehide', (event) => {
    // A page kept for back navigation comes back with its chat.
    if (!event.persisted) void history.dispose()
  })
}

if (IS_BROWSER) {
  exposeChatTransportOverride((factory) => {
    chatSession.setOverrideTransport(factory)
  })
}

export function useAIChat() {
  return {
    providerID,
    providerDef,
    apiKeyStatus,
    browserCredentialsRemembered,
    setAPIKey,
    resolveAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsKeyStatus,
    setPexelsKey,
    setRememberCredentials,
    unsplashKeyStatus,
    setUnsplashKey,
    activeTab: propertiesTab,
    isConfigured,
    history,
    ensureChat: history.ensureChat,
    resetChat: history.newChat,
    compactAgent: chatSession.compactAgent,
    chatFailure: chatSession.failure,
    clearChatFailure: chatSession.clearFailure
  }
}
