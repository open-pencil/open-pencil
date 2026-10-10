import { usePreferredDark } from '@vueuse/core'
import { watchEffect } from 'vue'

/**
 * Follows the system color scheme. The portal is served from the Cloud server's origin, so the
 * editor's stored theme and accent are not visible here; the stylesheet's default accent applies.
 */
export function usePortalTheme(): void {
  const prefersDark = usePreferredDark()
  watchEffect(() => {
    const value = prefersDark.value ? 'dark' : 'light'
    document.documentElement.dataset.theme = value
    document.documentElement.style.colorScheme = value
  })
}
