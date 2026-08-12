import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
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

  const { setTheme } = useAppTheme()
  const { dialogs } = useI18n()
  const actions: Partial<Record<string, () => void>> = {
    'open-storage-workspace': () => {
      void import('@/router').then(({ default: router }) => openStorageWorkspace(router))
    },
    settings: openSettingsDialog,
    'theme-light': () => setTheme('light'),
    'theme-dark': () => setTheme('dark'),
    'theme-auto': () => setTheme('auto'),
    'check-updates': () => void checkForAppUpdate({ messages: dialogs })
  }

  useNativeMenuEvents((id) => actions[id]?.())
}
