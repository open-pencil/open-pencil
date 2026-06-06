import { useTimeoutFn } from '@vueuse/core'
import { nextTick, ref } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

import {
  apiKey,
  customAPIType,
  customBaseURL,
  customModelID,
  isACPProvider,
  isConfigured,
  maxOutputTokens,
  modelID,
  falApiKey,
  pexelsApiKey,
  providerDef,
  providerID,
  recraftApiKey,
  registerAIChatEffects,
  setAPIKey,
  unsplashAccessKey,
  vectorizeProvider
} from '@/app/ai/chat/storage'
import { createChatSessionManager } from '@/app/ai/chat/transports'
import { exposeChatTransportOverride } from '@/app/browser-bridge'
import { getActiveEditorStore } from '@/app/editor/active-store'

const activeTab = ref<'design' | 'code' | 'ai'>('design')
/** Bumped to open the chat provider settings popover (see ProviderSettings.vue). */
export const providerSettingsOpenTick = ref(0)

/** Section to briefly highlight after opening the pane (e.g. 'vectorize'); a section
 *  binds a computed off this and the value auto-clears so the highlight fades. */
export const providerSettingsHighlight = ref<string | null>(null)
const { start: startHighlightClear } = useTimeoutFn(
  () => {
    providerSettingsHighlight.value = null
  },
  2200,
  { immediate: false }
)

/** Switches to AI tab and opens the existing provider settings popover. */
export function openProviderSettingsPane(highlight?: string) {
  activeTab.value = 'ai'
  void nextTick(() => {
    providerSettingsOpenTick.value += 1
    if (!highlight) return
    providerSettingsHighlight.value = highlight
    startHighlightClear() // restarts the auto-clear timer
  })
}

const chatSession = createChatSessionManager({
  isConfigured,
  isACPProvider,
  providerID,
  apiKey,
  modelID,
  customModelID,
  customBaseURL,
  customAPIType,
  maxOutputTokens,
  getActiveEditorStore
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
    apiKey,
    setAPIKey,
    modelID,
    customBaseURL,
    customModelID,
    customAPIType,
    maxOutputTokens,
    pexelsApiKey,
    unsplashAccessKey,
    vectorizeProvider,
    recraftApiKey,
    falApiKey,
    activeTab,
    isConfigured,
    ensureChat: chatSession.ensureChat,
    resetChat: chatSession.resetChat
  }
}
