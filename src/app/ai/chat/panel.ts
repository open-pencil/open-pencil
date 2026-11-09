import { ref, type Ref } from 'vue'

import { getActiveEditorStoreOrNull, type EditorStore } from '@/app/editor/active-store'

export type PropertiesTab = 'design' | 'code' | 'ai' | 'lint' | 'git'

/** The properties panel's tab; `ai` shows the chat. */
export const propertiesTab = ref<PropertiesTab>('design')

const floatingChats = new WeakMap<EditorStore, Ref<boolean>>()

/**
 * Whether the chat floats over this document's canvas, where it shows while the side panels are
 * hidden. Each document keeps its own, as each workspace did.
 */
export function floatingChatOpen(store: EditorStore): Ref<boolean> {
  let open = floatingChats.get(store)
  if (!open) {
    open = ref(false)
    floatingChats.set(store, open)
  }
  return open
}

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
    // `store` may be the active-store proxy; the flag belongs to the document itself.
    const open = floatingChatOpen(getActiveEditorStoreOrNull() ?? store)
    open.value = !open.value
    return
  }
  propertiesTab.value = propertiesTab.value === 'ai' ? 'design' : 'ai'
}
