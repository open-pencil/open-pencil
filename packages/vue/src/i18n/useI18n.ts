import { locale, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '#vue/i18n/locale'
import {
  menuMessages,
  commandMessages,
  toolMessages,
  panelMessages,
  pageMessages,
  dialogMessages
} from '#vue/i18n/messages'
import { useStore } from '@nanostores/vue'

import type { Locale } from '#vue/i18n/locale'
import type { Ref } from 'vue'

/**
 * Reactive i18n composable for OpenPencil Vue components.
 *
 * Returns reactive translation objects grouped by domain, plus locale
 * controls. All values update automatically when the locale changes.
 *
 * @example
 * ```vue
 * <script setup>
 * const { menu, commands, locale, setLocale } = useI18n()
 * </script>
 *
 * <template>
 *   <button>{{ menu.save }}</button>
 *   <span>{{ commands.undo }}</span>
 * </template>
 * ```
 */
export function useI18n() {
  return {
    menu: useStore(menuMessages),
    commands: useStore(commandMessages),
    tools: useStore(toolMessages),
    panels: useStore(panelMessages),
    pages: useStore(pageMessages),
    dialogs: useStore(dialogMessages),
    locale: useStore(locale) as Ref<Locale>,
    availableLocales: AVAILABLE_LOCALES,
    localeLabels: LOCALE_LABELS,
    setLocale
  }
}
