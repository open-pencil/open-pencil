import { ref } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

export type PropertiesTab = 'design' | 'code' | 'ai' | 'lint'

/** The properties panel's tab; `ai` shows the chat. */
export const propertiesTab = ref<PropertiesTab>('design')

/** Whether the chat floats over the canvas, where it shows while the side panels are hidden. */
export const floatingChatOpen = ref(false)

export function showChatPanel(): void {
  propertiesTab.value = 'ai'
}

/**
 * Shows the chat, or hides it again: in the properties panel, or floating over the canvas while
 * the panels are hidden. On a phone the chat is a ribbon tab in the drawer, which opens halfway
 * if it was closed.
 */
export function toggleChatPanel(store: EditorStore, mobile: boolean): void {
  if (mobile) {
    store.state.activeRibbonTab = store.state.activeRibbonTab === 'ai' ? 'panels' : 'ai'
    if (store.state.mobileDrawerSnap === 'closed') store.state.mobileDrawerSnap = 'half'
    return
  }
  if (!store.state.showUI) {
    floatingChatOpen.value = !floatingChatOpen.value
    return
  }
  propertiesTab.value = propertiesTab.value === 'ai' ? 'design' : 'ai'
}
