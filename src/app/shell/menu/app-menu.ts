import type { Component } from 'vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import IconDownload from '~icons/lucide/download'
import IconEye from '~icons/lucide/eye'
import IconFile from '~icons/lucide/file'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconLayers from '~icons/lucide/layers-2'
import IconPencil from '~icons/lucide/pencil'
import IconRedo from '~icons/lucide/redo-2'
import IconSave from '~icons/lucide/save'
import IconSettings from '~icons/lucide/settings'
import IconType from '~icons/lucide/type'
import IconUndo from '~icons/lucide/undo-2'
import IconZoomIn from '~icons/lucide/zoom-in'
import IconZoomOut from '~icons/lucide/zoom-out'

import type { CommandPaletteGroup, CommandPaletteItem, MenuEntry } from '@open-pencil/vue'
import { shortcutPlatform, useEditorCommands, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { createSharedEditorMenuActions } from '@/app/shell/menu/editor-actions'
import { openStorageWorkspace } from '@/app/shell/menu/navigation'
import type {
  AppMenuActionItem,
  AppMenuEntry,
  AppMenuGroupSchema,
  AppMenuIcon
} from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'
import { createSelectionMenuActions } from '@/app/shell/menu/selection-actions'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { openFileDialog } from '@/app/shell/menu/use'
import { useAppTheme } from '@/app/shell/theme'
import { closeTab, activeTab } from '@/app/tabs'

export interface AppMenuGroup {
  label: string
  paletteIcon?: Component
  items: MenuEntry[]
}

const APP_MENU_ICONS: Record<AppMenuIcon, Component> = {
  download: IconDownload,
  eye: IconEye,
  file: IconFile,
  'folder-open': IconFolderOpen,
  layers: IconLayers,
  pencil: IconPencil,
  redo: IconRedo,
  save: IconSave,
  settings: IconSettings,
  type: IconType,
  undo: IconUndo,
  'zoom-in': IconZoomIn,
  'zoom-out': IconZoomOut
}

function shortcutKeys(shortcut: string | undefined): string[] | undefined {
  if (!shortcut) return undefined
  const platform = shortcutPlatform()
  return shortcut.split('+').map((key) => {
    if (key === 'MOD') return platform === 'mac' ? '⌘' : 'Ctrl'
    if (key === 'SHIFT') return platform === 'mac' ? '⇧' : 'Shift'
    if (key === 'ALT') return platform === 'mac' ? '⌥' : 'Alt'
    return key
  })
}

function isVisible(entry: { target?: string }): boolean {
  return entry.target !== 'native'
}

function isSeparator(entry: AppMenuEntry): entry is Extract<AppMenuEntry, { type: 'separator' }> {
  return entry.type === 'separator'
}

export function useAppMenu() {
  const store = useEditorStore()
  const router = useRouter()
  const {
    commands,
    menuItem: commandMenuItem,
    otherPages,
    moveSelectionToPage
  } = useEditorCommands()
  const { menu, locale, availableLocales, localeLabels, setLocale } = useI18n()
  const { theme, setTheme } = useAppTheme()

  const translatedMenuItemLabels: Partial<Record<string, keyof typeof menu.value>> = {
    new: 'new',
    open: 'open',
    'open-storage-workspace': 'openStorageWorkspace',
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
    'selection.moveToPage': 'moveToPage',
    language: 'language',
    preferences: 'preferences',
    settings: 'settings',
    'view-rulers': 'rulers',
    'view-multiplayer-cursors': 'multiplayerCursors',
    'snap-geometry': 'snapToGeometry',
    'snap-objects': 'snapToObjects',
    'snap-pixel-grid': 'snapToPixelGrid',
    profiler: 'profiler',
    'toggle-ui': 'toggleUI',
    theme: 'theme',
    'theme-light': 'themeLight',
    'theme-dark': 'themeDark',
    'theme-auto': 'themeAuto',
    'zoom-in': 'zoomIn',
    'zoom-out': 'zoomOut',
    'view-split-right': 'splitRight',
    'view-split-down': 'splitDown',
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
    'open-storage-workspace': () => openStorageWorkspace(router),
    save: () => void store.saveFigFile(),
    'save-as': () => void store.saveFigFileAs(),
    'export-selection': () => exportSelection('png'),
    ...createSelectionMenuActions(store),
    close: () => {
      if (activeTab.value) void closeTab(activeTab.value.id)
    },
    settings: openSettingsDialog,
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
      case 'snap-geometry':
        return store.state.snappingPreferences.geometry
      case 'snap-objects':
        return store.state.snappingPreferences.objects
      case 'snap-pixel-grid':
        return store.state.snappingPreferences.pixelGrid
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
      case 'snap-geometry':
        return (value: boolean) => setSnappingPreference('geometry', value)
      case 'snap-objects':
        return (value: boolean) => setSnappingPreference('objects', value)
      case 'snap-pixel-grid':
        return (value: boolean) => setSnappingPreference('pixelGrid', value)
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

  function disabled(item: AppMenuActionItem): boolean | undefined {
    switch (item.id) {
      case 'view-split-right':
      case 'view-split-down':
        return store.visiblePaneCount.value >= store.panes.maxVisiblePanes
      default:
        return undefined
    }
  }

  function menuLabel(entry: AppMenuActionItem): string {
    const key = translatedMenuItemLabels[entry.id]
    return key ? menu.value[key] : entry.label
  }

  function resolvePalette(entry: AppMenuActionItem) {
    return entry.palette
      ? {
          ...entry.palette,
          label: entry.palette.label ? menu.value[entry.palette.label] : undefined,
          icon: entry.palette.icon ? APP_MENU_ICONS[entry.palette.icon] : undefined
        }
      : undefined
  }

  function buildEntry(entry: AppMenuEntry): MenuEntry | null {
    if (!isVisible(entry)) return null
    if (isSeparator(entry)) return { separator: true }

    if (entry.id === 'language') {
      return { label: menuLabel(entry), sub: languageMenu.value }
    }

    if (entry.id === 'selection.moveToPage') {
      if (otherPages.value.length === 0) return null
      const disabled = !commands['selection.moveToPage'].enabled.value
      return {
        label: menuLabel(entry),
        disabled,
        sub: otherPages.value.map((page) => ({
          label: page.name,
          disabled,
          action: () => moveSelectionToPage(page.id)
        }))
      }
    }

    if (entry.command) {
      return {
        ...commandMenuItem(entry.command, appMenuShortcutLabel(entry.id)),
        menuId: entry.id,
        palette: resolvePalette(entry),
        paletteShortcut: entry.shortcut
      }
    }

    return {
      menuId: entry.id,
      label: menuLabel(entry),
      palette: resolvePalette(entry),
      paletteShortcut: entry.shortcut,
      shortcut: appMenuShortcutLabel(entry.id),
      action: itemAction(entry),
      disabled: disabled(entry),
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
      paletteIcon: group.paletteIcon ? APP_MENU_ICONS[group.paletteIcon] : undefined,
      items: group.items.map(buildEntry).filter((item): item is MenuEntry => item !== null)
    }
  }

  function paletteEntries(
    entry: MenuEntry,
    category: string,
    fallbackIcon?: Component
  ): CommandPaletteItem[] {
    if ('separator' in entry) return []
    if (!entry.menuId)
      return entry.sub?.flatMap((child) => paletteEntries(child, category, fallbackIcon)) ?? []

    const item: CommandPaletteItem = {
      id: entry.menuId,
      label: entry.palette?.label ?? entry.label,
      icon: entry.palette?.icon ?? fallbackIcon,
      shortcut: entry.paletteShortcut
        ? { keys: shortcutKeys(entry.paletteShortcut) ?? [] }
        : undefined,
      description: entry.palette?.description,
      keywords: entry.palette?.keywords,
      disabled: entry.disabled,
      onSelect:
        entry.action ??
        (entry.onCheckedChange ? () => entry.onCheckedChange?.(!entry.checked) : undefined)
    }
    const children =
      entry.sub?.flatMap((child) => paletteEntries(child, category, fallbackIcon)) ?? []
    return [item, ...children]
  }

  const topMenus = computed<AppMenuGroup[]>(() =>
    APP_MENU_SCHEMA.map(buildGroup).filter((group): group is AppMenuGroup => group !== null)
  )

  const commandGroups = computed<CommandPaletteGroup[]>(() =>
    topMenus.value.map((group) => ({
      id: group.label.toLowerCase(),
      label: group.label,
      items: group.items.flatMap((entry) => paletteEntries(entry, group.label, group.paletteIcon))
    }))
  )

  return { topMenus, commandGroups }
}
