import { IS_BROWSER } from '@open-pencil/core/constants'

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
  }
})

registerAIChatEffects(chatSession.markTransportDirty)

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
    chatFailure: chatSession.failure,
    clearChatFailure: chatSession.clearFailure
  }
}
