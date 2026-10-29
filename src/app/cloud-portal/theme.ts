import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { watchEffect } from 'vue'

import {
  DEFAULT_THEME,
  resolveAppTheme,
  THEME_STORAGE_KEY,
  type AppTheme
} from '@/app/settings/theme'

/**
 * Takes the editor's theme, which a Cloud server's pages share with the editor it serves from the
 * same address, so the boot splash and the page keep the editor's colours. Elsewhere, as for the
 * metrics dashboard, no theme is stored and the editor's default applies. The editor's accent
 * stays the editor's; the stylesheet's default accent applies.
 */
export function usePortalTheme(): void {
  const setting = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_THEME, {
    writeDefaults: false
  })
  const prefersDark = usePreferredDark()
  watchEffect(() => {
    const value = resolveAppTheme(setting.value, prefersDark.value)
    document.documentElement.dataset.theme = value
    document.documentElement.style.colorScheme = value
  })
}
