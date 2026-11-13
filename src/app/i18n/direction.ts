import { getQuery } from 'ufo'
import { computed } from 'vue'

import { RIGHT_TO_LEFT_LOCALES, useI18n, type Locale } from '@open-pencil/vue/i18n'

import { appPreferences, updateMirrorInterface } from '@/app/settings/preferences/store'

/** Whether a right-to-left language mirrors the interface. */
export const mirrorInterfacePreference = computed({
  get: () => appPreferences.value.appearance.mirrorInterface,
  set: updateMirrorInterface
})

export function isRightToLeftLocale(code: Locale): boolean {
  return code !== 'en' && RIGHT_TO_LEFT_LOCALES.has(code)
}

/**
 * Development builds mirror the interface in any language with `?dir=rtl`, so it can be checked
 * without reading Arabic; English sentences then show their closing punctuation at the start.
 */
const forcedRightToLeft =
  import.meta.env.DEV && typeof location !== 'undefined' && getQuery(location.search).dir === 'rtl'

/**
 * The direction the interface reads in: right to left for a right-to-left language unless the
 * person turned mirroring off. The canvas and what describes it (rulers, coordinates, colors,
 * code) stay left to right inside their own `dir="ltr"` elements.
 */
export function useInterfaceDirection() {
  const { locale } = useI18n()
  return computed<'ltr' | 'rtl'>(() =>
    forcedRightToLeft || (isRightToLeftLocale(locale.value) && mirrorInterfacePreference.value)
      ? 'rtl'
      : 'ltr'
  )
}
