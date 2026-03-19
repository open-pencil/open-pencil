import { useI18n as useVueI18n } from 'vue-i18n'
import { computed } from 'vue'
import { SUPPORTED_LOCALES, LOCALE_NAMES, type LocaleCode } from '@/locales/types'
import { setLocale, getLocale } from '@/i18n'

export function useI18n() {
  const { t, locale } = useVueI18n()

  const currentLocale = computed({
    get: () => locale.value as LocaleCode,
    set: (val: LocaleCode) => {
      setLocale(val)
    }
  })

  const availableLocales = SUPPORTED_LOCALES

  const localeNames = LOCALE_NAMES

  return {
    t,
    locale: currentLocale,
    setLocale,
    getLocale,
    availableLocales,
    localeNames
  }
}