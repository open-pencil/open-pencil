import { useEditorCommands } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { clearRecentFiles, forgetRecentFile, recentLocalFileAt } from '@/app/recent-files'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import { openFileDialog, openFileFromPath } from '@/app/shell/menu/files'
import { useNativeMenuEvents } from '@/app/shell/menu/native-events'
import { OPEN_RECENT_EVENT_PREFIX, watchRecentFilesMenu } from '@/app/shell/menu/recent-files'
import { APP_MENU_SCHEMA, type AppMenuEntry } from '@/app/shell/menu/schema'
import { createSelectionMenuActions } from '@/app/shell/menu/selection-actions'
import { SHELL_MENU_IDS } from '@/app/shell/menu/shell'
import { useAppTheme } from '@/app/shell/theme'
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

export function useEditorMenu() {
  if (!isTauri()) return

  watchRecentFilesMenu()

  const { setTheme } = useAppTheme()
  const { runCommand } = useEditorCommands()

  const actions: Partial<Record<string, () => void>> = {
    new: () => createTab(),
    open: () => void openFileDialog(),
    close: () => {
      if (activeTab.value) void closeTab(activeTab.value.id)
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
    ...createSharedEditorMenuActions(setTheme)
  }

  useNativeMenuEvents((id) => {
    if (id === 'clear-recent-files') {
      void clearRecentFiles()
      return
    }
    if (id.startsWith(OPEN_RECENT_EVENT_PREFIX)) {
      const index = Number(id.slice(OPEN_RECENT_EVENT_PREFIX.length))
      const path = Number.isInteger(index) ? recentLocalFileAt(index) : null
      if (path) {
        void openFileFromPath(path).catch((error) => {
          forgetRecentFile(path)
          console.warn('[Recent files] Failed to open file', error)
        })
      }
      return
    }
    if (SHELL_MENU_IDS.has(id)) return
    if (COMMAND_MENU_IDS.has(id as EditorCommandId)) {
      runCommand(id as EditorCommandId)
      return
    }
    actions[id]?.()
  })
}
