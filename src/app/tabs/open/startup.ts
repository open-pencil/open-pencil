import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'

import { joinRoom, roomForStore } from '@/app/collab/rooms'
import { activeStorageProviderID, createStorageAdapter } from '@/app/integrations/storage'
import { appRuntimeConfig } from '@/app/runtime/config'
import { appPreferences, type StartupOpen } from '@/app/settings/preferences/store'
import { openFileFromPath } from '@/app/shell/menu/files'
import { toast } from '@/app/shell/ui'
import {
  allTabs,
  getActiveTabId,
  getTabsSnapshot,
  openStorageDocumentInNewTab,
  showNewTab,
  switchTab
} from '@/app/tabs'
import {
  describeOpenTabs,
  lastSession,
  restoreLastSession,
  storedDocumentMetadata
} from '@/app/tabs/open/last-session'
import { IS_TAURI } from '@/constants'

/** The start screen chosen in Settings; reopening the last designs when none was chosen. */
export function startupOpenChoice(): StartupOpen {
  return appPreferences.value.startup.open ?? 'reopen'
}

/** The first tab to show: the open screen where the platform has one, else a new design. */
export function startupFirstTab(choice: StartupOpen): 'home' | 'new' {
  if (choice === 'new') return 'new'
  if (choice === 'home') return 'home'
  if (lastSession.value?.documents.length) return 'home'
  return IS_TAURI || appRuntimeConfig.recentFiles ? 'home' : 'new'
}

/** Reopens the designs that were open last; shows the open screen when one cannot open. */
export async function reopenLastSession(messages: {
  sharedFile: string
  reopenIncomplete: string
}): Promise<void> {
  const session = lastSession.value
  if (!session?.documents.length) return
  const allOpened = await restoreLastSession(session, {
    activeProviderId: activeStorageProviderID.value,
    async openPath(path) {
      if (!IS_TAURI) throw new Error('Files open by path only in the desktop app')
      await openFileFromPath(path)
    },
    joinRoom: (roomId) => joinRoom(roomId, { tabName: messages.sharedFile }) !== null,
    storageMetadata: (documentId, location) =>
      storedDocumentMetadata(createStorageAdapter(location), documentId),
    async openStorageDocument(document, location) {
      await openStorageDocumentInNewTab(document, location)
    },
    activeTabId: getActiveTabId,
    focus: switchTab
  })
  if (!allOpened) {
    toast.info(messages.reopenIncomplete)
    showNewTab()
  }
}

/** Keeps the list of open designs current so the next start can reopen them. */
export function recordOpenDocuments(ready: () => boolean): void {
  const record = () => {
    if (!ready()) return
    const tabs = getTabsSnapshot().map((tab) => {
      const room = roomForStore(tab.store)
      return { ...tab, roomId: room?.origin === 'joined' ? room.roomId : null }
    })
    lastSession.value = describeOpenTabs(tabs, getActiveTabId())
  }
  watch(allTabs, record)
  useEventListener(window, 'pagehide', record)
}
