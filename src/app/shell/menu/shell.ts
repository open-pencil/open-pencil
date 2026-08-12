import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useNativeMenuEvents } from '@/app/shell/menu/native-events'
import { openStorageWorkspace } from '@/app/shell/menu/navigation'
import { useAppTheme } from '@/app/shell/theme'
import { checkForAppUpdate } from '@/app/shell/updater'
import { isTauri } from '@/app/tauri/env'

export const SHELL_MENU_IDS = new Set([
  'open-storage-workspace',
  'settings',
  'theme-light',
  'theme-dark',
  'theme-auto',
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
