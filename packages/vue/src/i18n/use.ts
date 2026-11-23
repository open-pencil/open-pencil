import { useStore } from '@nanostores/vue'
import type { StoreValue } from 'nanostores'
import type { Ref } from 'vue'

import { locale, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '#vue/i18n/locale'
import type { Locale } from '#vue/i18n/locale'
import { messageStores } from '#vue/i18n/messages'
import type { MessageNamespace } from '#vue/i18n/messages'

/** A namespace's messages in the current locale. */
export type MessagesOf<Namespace extends MessageNamespace> = StoreValue<
  (typeof messageStores)[Namespace]
>

/** A namespace's messages, following the locale: `useMessages('panels/pickers')`. */
export function useMessages<Namespace extends MessageNamespace>(namespace: Namespace) {
  return useStore(messageStores[namespace]) as Ref<MessagesOf<Namespace>>
}

/** The interface's locale, the locales it can switch to, and their names in their own language. */
export function useLocale() {
  return {
    locale: useStore(locale) as Ref<Locale>,
    availableLocales: AVAILABLE_LOCALES,
    localeLabels: LOCALE_LABELS,
    setLocale
  }
}
