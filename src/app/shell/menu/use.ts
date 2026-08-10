import { tryOnScopeDispose } from '@vueuse/core'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import { importFileDialog, openFileDialog, openFileFromPath } from '@/app/shell/menu/files'
import { openStorageWorkspace } from '@/app/shell/menu/navigation'
import {
  OPEN_RECENT_EVENT_PREFIX,
  clearRecentFiles,
  forgetRecentFile,
  recentFileAt,
  syncRecentFilesMenu
} from '@/app/shell/menu/recent-files'
import { APP_MENU_SCHEMA, type AppMenuEntry } from '@/app/shell/menu/schema'
import { createSelectionMenuActions } from '@/app/shell/menu/selection-actions'
import { useAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { checkForAppUpdate } from '@/app/shell/updater'
import { createTab, closeTab, activeTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

function commandMenuIds(entries: readonly AppMenuEntry[]): EditorCommandId[] {
  return entries.flatMap((entry) => {
    if (entry.type === 'separator') return []
    return [...(entry.command ? [entry.command] : []), ...commandMenuIds(entry.sub ?? [])]
  })
}

const store = useEditorStore()
const COMMAND_MENU_IDS = new Set<EditorCommandId>(
  APP_MENU_SCHEMA.flatMap((group) => commandMenuIds(group.items))
)

export { importFileDialog, openFileDialog }
export { openFileFromPath } from '@/app/shell/menu/files'

export function useMenu() {
  if (!isTauri()) return

  let unlisten: (() => void) | undefined
  const { setTheme } = useAppTheme()
  const { dialogs } = useI18n()
  const { runCommand } = useEditorCommands()

  async function openRecentFile(index: number): Promise<void> {
    const path = recentFileAt(index)
    if (!path) return
    try {
      await openFileFromPath(path)
    } catch (error) {
      forgetRecentFile(path)
      toast.error(
        `Failed to open recent file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  const actions: Partial<Record<string, () => void>> = {
    new: () => createTab(),
    open: () => void openFileDialog(),
    'open-storage-workspace': () => {
      void import('@/router').then(({ default: router }) => openStorageWorkspace(router))
    },
    close: () => {
      if (activeTab.value) closeTab(activeTab.value.id)
    },
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'export-selection': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
    },
    'export-png': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
    },
    'export-svg': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'svg')
    },
    'export-pptx': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'pptx')
    },
    'export-fig': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'fig')
    },
    autosave: () => {
      store.state.autosaveEnabled = !store.state.autosaveEnabled
    },
    ...createSelectionMenuActions(store),
    'check-updates': () => void checkForAppUpdate({ messages: dialogs }),
    settings: openSettingsDialog,
    ...createSharedEditorMenuActions(setTheme)
  }

  void syncRecentFilesMenu().catch((error) => {
    console.warn('[Recent files] Failed to initialize the native menu', error)
  })

  void import('@tauri-apps/api/event').then(({ listen }) => {
    return listen<string>('menu-event', (event) => {
      if (event.payload.startsWith(OPEN_RECENT_EVENT_PREFIX)) {
        const index = Number(event.payload.slice(OPEN_RECENT_EVENT_PREFIX.length))
        if (Number.isInteger(index) && index >= 0) void openRecentFile(index)
        return
      }
      if (event.payload === 'clear-recent-files') {
        clearRecentFiles()
        return
      }
      if (COMMAND_MENU_IDS.has(event.payload as EditorCommandId)) {
        runCommand(event.payload as EditorCommandId)
        return
      }
      actions[event.payload]?.()
    }).then((fn) => {
      unlisten = fn
      return undefined
    })
  })

  tryOnScopeDispose(() => unlisten?.())
}
