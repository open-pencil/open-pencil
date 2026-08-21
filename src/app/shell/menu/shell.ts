import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { setSnappingPreference } from '@/app/settings/preferences/apply'
import { syncNativeSnappingMenu } from '@/app/settings/preferences/native-menu'
import { appPreferences } from '@/app/settings/preferences/store'
import { useNativeMenuEvents } from '@/app/shell/menu/native-events'
import { openStorageWorkspace } from '@/app/shell/menu/navigation'
import { APP_MENU_SCHEMA, type AppMenuEntry } from '@/app/shell/menu/schema'
import { useAppTheme } from '@/app/shell/theme'
import { checkForAppUpdate } from '@/app/shell/updater'
import { isTauri } from '@/app/tauri/env'

function shellMenuIds(entries: readonly AppMenuEntry[]): string[] {
  return entries.flatMap((entry) => {
    if (entry.type === 'separator') return []
    return [...(entry.handler === 'shell' ? [entry.id] : []), ...shellMenuIds(entry.sub ?? [])]
  })
}

export const SHELL_MENU_IDS = new Set([
  ...APP_MENU_SCHEMA.flatMap((group) => shellMenuIds(group.items)),
  // The macOS application menu is native-only and is not part of the shared schema.
  'check-updates'
])

export function useShellMenu() {
  if (!isTauri()) return

  void syncNativeSnappingMenu(appPreferences.value.editing.snapping).catch((error: unknown) => {
    console.error('[Menu] Failed to synchronize native snapping preferences:', error)
  })

  const { setTheme } = useAppTheme()
  const { updates } = useI18n()
  const actions: Partial<Record<string, () => void>> = {
    'open-storage-workspace': () => {
      void import('@/router').then(({ default: router }) => openStorageWorkspace(router))
    },
    settings: openSettingsDialog,
    'snap-geometry': () => {
      const current = appPreferences.value.editing.snapping.geometry
      setSnappingPreference('geometry', !current)
    },
    'snap-objects': () => {
      const current = appPreferences.value.editing.snapping.objects
      setSnappingPreference('objects', !current)
    },
    'snap-pixel-grid': () => {
      const current = appPreferences.value.editing.snapping.pixelGrid
      setSnappingPreference('pixelGrid', !current)
    },
    'theme-light': () => setTheme('light'),
    'theme-dark': () => setTheme('dark'),
    'theme-auto': () => setTheme('auto'),
    'check-updates': () => void checkForAppUpdate({ messages: updates })
  }

  useNativeMenuEvents((id) => actions[id]?.())
}
