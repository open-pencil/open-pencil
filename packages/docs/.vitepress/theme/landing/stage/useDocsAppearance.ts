import { useData } from 'vitepress'
import { effectScope, watch } from 'vue'

import { AVAILABLE_LOCALES, setLocale, type Locale } from '@open-pencil/vue'

import { useAppTheme } from '@/app/shell/theme'

let started = false

function isAppLocale(value: string): value is Locale {
  return (AVAILABLE_LOCALES as readonly string[]).includes(value)
}

/**
 * Keeps the embedded app in step with the docs site: its light or dark theme follows the
 * VitePress appearance switch, and its interface language follows the docs locale. The app
 * keeps both as page-wide state, so one detached scope serves every stage on the page.
 */
export function useDocsAppearance(): void {
  if (started) return
  started = true
  const { isDark, lang } = useData()
  effectScope(true).run(() => {
    const { setTheme } = useAppTheme()
    watch(isDark, (dark) => setTheme(dark ? 'dark' : 'light'), { immediate: true })
    watch(
      lang,
      (value) => {
        if (isAppLocale(value)) setLocale(value)
      },
      { immediate: true }
    )
  })
}
