import { computed } from 'vue'

import { useEditorCommands, useI18n } from '@open-pencil/vue'
import type { MenuEntry } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import type { AppMenuActionItem, AppMenuEntry, AppMenuGroupSchema } from '@/app/shell/menu/schema'
import { openFileDialog } from '@/app/shell/menu/use'
import { useAppTheme } from '@/app/shell/theme'

export interface AppMenuGroup {
  label: string
  items: MenuEntry[]
}

function shortcutLabel(shortcut: string | undefined, mod: string): string | undefined {
  return shortcut?.replaceAll('MOD', mod)
}

function isVisible(entry: { target?: string }): boolean {
  return entry.target !== 'native'
}

function isSeparator(entry: AppMenuEntry): entry is Extract<AppMenuEntry, { type: 'separator' }> {
  return entry.type === 'separator'
}

export function useAppMenu(mod: string) {
  const store = useEditorStore()
  const { menuItem: commandMenuItem } = useEditorCommands()
  const { locale, availableLocales, localeLabels, setLocale } = useI18n()
  const { theme, setTheme } = useAppTheme()

  const languageMenu = computed<MenuEntry[]>(() =>
    availableLocales.map((code) => ({
      label: localeLabels[code],
      checked: locale.value === code,
      onCheckedChange: (checked: boolean) => {
        if (checked) setLocale(code)
      }
    }))
  )

  function exportSelection(format: 'png' | 'svg' | 'fig') {
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
    'export-png': () => exportSelection('png'),
    'export-svg': () => exportSelection('svg'),
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

  function buildEntry(entry: AppMenuEntry): MenuEntry | null {
    if (!isVisible(entry)) return null
    if (isSeparator(entry)) return { separator: true }

    if (entry.id === 'language') {
      return { label: entry.label, sub: languageMenu.value }
    }

    if (entry.command) {
      return commandMenuItem(entry.command, shortcutLabel(entry.shortcut, mod))
    }

    return {
      label: entry.label,
      shortcut: shortcutLabel(entry.shortcut, mod),
      action: itemAction(entry),
      checked: checked(entry),
      onCheckedChange: onCheckedChange(entry),
      sub: entry.sub?.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  function buildGroup(group: AppMenuGroupSchema): AppMenuGroup | null {
    if (!isVisible(group)) return null
    return {
      label: group.label,
      items: group.items.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  const topMenus = computed<AppMenuGroup[]>(() =>
    APP_MENU_SCHEMA.map(buildGroup).filter((group): group is AppMenuGroup => group !== null)
  )

  return { topMenus }
}
