import { tryOnScopeDispose } from '@vueuse/core'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { importFileDialog, openFileDialog } from '@/app/shell/menu/files'
import { useAppTheme } from '@/app/shell/theme'
import { checkForAppUpdate } from '@/app/shell/updater'
import { createTab, closeTab, activeTab } from '@/app/tabs'
import { isTauri } from '@/app/tauri/env'

const store = useEditorStore()
const COMMAND_MENU_IDS = new Set<string>([
  'edit.undo',
  'edit.redo',
  'selection.selectAll',
  'selection.duplicate',
  'selection.delete',
  'selection.group',
  'selection.ungroup',
  'selection.createComponent',
  'selection.createComponentSet',
  'selection.detachInstance',
  'selection.wrapInAutoLayout',
  'selection.bringToFront',
  'selection.sendToBack',
  'view.zoom100',
  'view.zoomFit',
  'view.zoomSelection'
])

export { importFileDialog, openFileDialog }
export { openFileFromPath } from '@/app/shell/menu/files'

function execBrowserCommand(command: 'copy' | 'paste'): void {
  document.execCommand(command)
}

function alignSelected(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max'): void {
  store.alignNodes([...store.state.selectedIds], axis, align)
}

function updateSelectedText(updates: {
  fontWeight?: number
  italic?: boolean
  textDecoration?: 'NONE' | 'UNDERLINE'
}): void {
  for (const node of store.selectedNodes.value) {
    if (node.type === 'TEXT') store.updateNodeWithUndo(node.id, updates, 'Format text')
  }
}

export function useMenu() {
  if (!isTauri()) return

  let unlisten: (() => void) | undefined
  const { setTheme } = useAppTheme()
  const { dialogs } = useI18n()
  const { runCommand } = useEditorCommands()

  const actions: Partial<Record<string, () => void>> = {
    new: () => createTab(),
    open: () => void openFileDialog(),
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
    'export-fig': () => {
      if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'fig')
    },
    autosave: () => {
      store.state.autosaveEnabled = !store.state.autosaveEnabled
    },
    copy: () => execBrowserCommand('copy'),
    paste: () => execBrowserCommand('paste'),
    'zoom-in': () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2),
    'zoom-out': () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2),
    'theme-light': () => setTheme('light'),
    'theme-dark': () => setTheme('dark'),
    'theme-auto': () => setTheme('auto'),
    'toggle-ui': () => {
      store.state.showUI = !store.state.showUI
    },
    'check-updates': () => void checkForAppUpdate({ messages: dialogs }),
    'text.bold': () => {
      const node = store.selectedNodes.value.find((item) => item.type === 'TEXT')
      updateSelectedText({ fontWeight: node && node.fontWeight >= 700 ? 400 : 700 })
    },
    'text.italic': () => {
      const node = store.selectedNodes.value.find((item) => item.type === 'TEXT')
      updateSelectedText({ italic: node ? !node.italic : true })
    },
    'text.underline': () => {
      const node = store.selectedNodes.value.find((item) => item.type === 'TEXT')
      updateSelectedText({
        textDecoration: node?.textDecoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE'
      })
    },
    'align-left': () => alignSelected('horizontal', 'min'),
    'align-center': () => alignSelected('horizontal', 'center'),
    'align-right': () => alignSelected('horizontal', 'max'),
    'align-top': () => alignSelected('vertical', 'min'),
    'align-middle': () => alignSelected('vertical', 'center'),
    'align-bottom': () => alignSelected('vertical', 'max')
  }

  void import('@tauri-apps/api/event').then(({ listen }) => {
    void listen<string>('menu-event', (event) => {
      if (COMMAND_MENU_IDS.has(event.payload)) {
        runCommand(event.payload as EditorCommandId)
        return
      }
      actions[event.payload]?.()
    }).then((fn) => {
      unlisten = fn
    })
  })

  tryOnScopeDispose(() => unlisten?.())
}
