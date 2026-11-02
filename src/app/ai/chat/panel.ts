import { ref } from 'vue'

export type PropertiesTab = 'design' | 'code' | 'ai' | 'lint'

/** The properties panel's tab; `ai` shows the chat. */
export const propertiesTab = ref<PropertiesTab>('design')

export function showChatPanel(): void {
  propertiesTab.value = 'ai'
}
