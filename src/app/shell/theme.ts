import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watchEffect } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'

export type AppTheme = 'dark' | 'light' | 'auto'

const THEME_STORAGE_KEY = 'open-pencil:theme'
const DEFAULT_THEME: AppTheme = 'dark'

const theme = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_THEME)
const prefersDark = usePreferredDark()
const resolvedTheme = computed<'dark' | 'light'>(() => {
  if (theme.value === 'auto') return prefersDark.value ? 'dark' : 'light'
  return theme.value
})

function applyTheme(value: 'dark' | 'light', setting: AppTheme): void {
  if (!IS_BROWSER) return
  document.documentElement.dataset.theme = value
  document.documentElement.dataset.themeSetting = setting
  document.documentElement.style.colorScheme = value
}

export function useAppTheme() {
  watchEffect(() => applyTheme(resolvedTheme.value, theme.value))

  const isLight = computed(() => resolvedTheme.value === 'light')

  function setTheme(value: AppTheme): void {
    theme.value = value
  }

  function toggleTheme(): void {
    theme.value = isLight.value ? 'dark' : 'light'
  }

  return { theme, resolvedTheme, isLight, setTheme, toggleTheme }
}

applyTheme(resolvedTheme.value, theme.value)
