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

if (import.meta.hot) {
  // Vite waits for these callbacks before replacing the module or reloading the page.
  // Tauri's shell children otherwise survive the WebView and keep agent sessions locked.
  /* eslint-disable typescript-eslint/no-misused-promises -- Vite awaits these callbacks despite their void return types. */
  import.meta.hot.dispose(history.dispose)
  import.meta.hot.on('vite:beforeFullReload', history.dispose)
  import.meta.hot.on('vite:ws:disconnect', history.dispose)
  /* eslint-enable typescript-eslint/no-misused-promises */
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
