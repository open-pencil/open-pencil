import { computed } from 'vue'

import type { MenuEntry } from '@open-pencil/vue'
import { useEditorCommands, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { openRenameSelectionDialog } from '@/app/editor/selection/rename-dialog'
import { openSettingsDialog } from '@/app/settings/dialog'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { openFileDialog } from '@/app/shell/menu/use'
import { useAppTheme } from '@/app/shell/theme'
import { closeTab, activeTab } from '@/app/tabs'

export interface AppMenuGroup {
  label: string
  items: MenuEntry[]
}

function isVisible(entry: { target?: string }): boolean {
  return entry.target !== 'native'
}

function isSeparator(entry: AppMenuEntry): entry is Extract<AppMenuEntry, { type: 'separator' }> {
  return entry.type === 'separator'
}

export function useAppMenu() {
  const store = useEditorStore()
  const { menuItem: commandMenuItem, otherPages, moveSelectionToPage } = useEditorCommands()
  const { menu, locale, availableLocales, localeLabels, setLocale } = useI18n()
  const { theme, setTheme } = useAppTheme()

  const translatedMenuItemLabels: Partial<Record<string, keyof typeof menu.value>> = {
    new: 'new',
    open: 'open',
    save: 'save',
    'save-as': 'saveAs',
    'export-selection': 'exportSelection',
    autosave: 'autosave',
    close: 'closeTab',
    copy: 'copy',
    cut: 'cut',
    paste: 'paste',
    'paste-to-replace': 'pasteToReplace',
    'selection.rename': 'renameSelection',
    language: 'language',
    settings: 'settings',
    'view-rulers': 'rulers',
    'view-multiplayer-cursors': 'multiplayerCursors',
    profiler: 'profiler',
    'toggle-ui': 'toggleUI',
    theme: 'theme',
    'theme-light': 'themeLight',
    'theme-dark': 'themeDark',
    'theme-auto': 'themeAuto',
    'zoom-in': 'zoomIn',
    'zoom-out': 'zoomOut',
    'text.bold': 'bold',
    'text.italic': 'italic',
    'text.underline': 'underline',
    'arrange.align-left': 'arrangeAlignLeft',
    'arrange.align-center': 'arrangeAlignCenter',
    'arrange.align-right': 'arrangeAlignRight',
    'arrange.align-top': 'arrangeAlignTop',
    'arrange.align-middle': 'arrangeAlignMiddle',
    'arrange.align-bottom': 'arrangeAlignBottom'
  }

  const languageMenu = computed<MenuEntry[]>(() =>
    availableLocales.map((code) => ({
      label: localeLabels[code],
      checked: locale.value === code,
      onCheckedChange: (checked: boolean) => {
        if (checked) setLocale(code)
      }
    }))
  )

  function exportSelection(format: 'png' | 'svg' | 'pptx' | 'fig') {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, format)
  }

  const actions: Partial<Record<string, () => void>> = {
    new: () => {
      void import('@/app/tabs').then((m) => m.createTab())
    },
    open: () => void openFileDialog(),
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'export-selection': () => exportSelection('png'),
    copy: () => void executeClipboardCommand(store, 'copy'),
    cut: () => void executeClipboardCommand(store, 'cut'),
    paste: () => void executeClipboardCommand(store, 'paste'),
    'paste-to-replace': () => void pasteClipboardToReplace(store),
    close: () => {
      if (activeTab.value) closeTab(activeTab.value.id)
    },
    settings: openSettingsDialog,
    'selection.rename': () => openRenameSelectionDialog(store),
    'export-png': () => exportSelection('png'),
    'export-svg': () => exportSelection('svg'),
    'export-pptx': () => exportSelection('pptx'),
    'export-fig': () => exportSelection('fig'),
    ...createSharedEditorMenuActions(setTheme)
  }

  function itemAction(item: AppMenuActionItem): (() => void) | undefined {
    return actions[item.id]
  }

  function checked(item: AppMenuActionItem): boolean | undefined {
    switch (item.id) {
      case 'autosave':
        return store.state.autosaveEnabled
      case 'profiler':
        return store.renderer?.profiler.hudVisible ?? false
      case 'view-rulers':
        return store.state.showRulers
      case 'view-multiplayer-cursors':
        return store.state.showRemoteCursors
      case 'theme-light':
        return theme.value === 'light'
      case 'theme-dark':
        return theme.value === 'dark'
      case 'theme-auto':
        return theme.value === 'auto'
      default:
        return undefined
    }
  }

  function onCheckedChange(item: AppMenuActionItem): ((checked: boolean) => void) | undefined {
    switch (item.id) {
      case 'autosave':
        return (value: boolean) => {
          store.state.autosaveEnabled = value
        }
      case 'profiler':
        return () => store.toggleProfiler()
      case 'view-rulers':
        return (value: boolean) => {
          if (store.state.showRulers !== value) itemAction(item)?.()
        }
      case 'view-multiplayer-cursors':
        return (value: boolean) => {
          if (store.state.showRemoteCursors !== value) itemAction(item)?.()
        }
      case 'theme-light':
      case 'theme-dark':
      case 'theme-auto':
        return (value: boolean) => {
          if (value) itemAction(item)?.()
        }
      default:
        return undefined
    }
  }

  function menuLabel(entry: AppMenuActionItem): string {
    const key = translatedMenuItemLabels[entry.id]
    return key ? menu.value[key] : entry.label
  }

  function buildEntry(entry: AppMenuEntry): MenuEntry | null {
    if (!isVisible(entry)) return null
    if (isSeparator(entry)) return { separator: true }

    if (entry.id === 'language') {
      return { label: menuLabel(entry), sub: languageMenu.value }
    }

    if (entry.id === 'selection.moveToPage') {
      if (otherPages.value.length === 0) return null
      return {
        label: menuLabel(entry),
        sub: otherPages.value.map((page) => ({
          label: page.name,
          action: () => moveSelectionToPage(page.id)
        }))
      }
    }

    if (entry.command) {
      return commandMenuItem(entry.command, appMenuShortcutLabel(entry.id))
    }

    return {
      label: menuLabel(entry),
      shortcut: appMenuShortcutLabel(entry.id),
      action: itemAction(entry),
      checked: checked(entry),
      onCheckedChange: onCheckedChange(entry),
      sub: entry.sub?.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  function groupLabel(group: AppMenuGroupSchema): string {
    const key = group.label.toLowerCase() as keyof typeof menu.value
    return menu.value[key] ?? group.label
  }

  function buildGroup(group: AppMenuGroupSchema): AppMenuGroup | null {
    if (!isVisible(group)) return null
    return {
      label: groupLabel(group),
      items: group.items.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  const topMenus = computed<AppMenuGroup[]>(() =>
    APP_MENU_SCHEMA.map(buildGroup).filter((group): group is AppMenuGroup => group !== null)
  )

  return { topMenus }
}
