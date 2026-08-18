import { useStore } from '@nanostores/vue'
import type { Store, StoreValue } from 'nanostores'
import type { Ref } from 'vue'

import { locale, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '#vue/i18n/locale'
import type { Locale } from '#vue/i18n/locale'
import {
  menuMessages,
  commandMessages,
  toolMessages,
  panelMessages,
  variableTypeMessages,
  pageMessages,
  dialogMessages
} from '#vue/i18n/messages'

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
export function useI18nNamespace<MessagesStore extends Store>(messages: MessagesStore) {
  return useStore(messages) as Ref<StoreValue<MessagesStore>>
}

export function useMenuMessages() {
  return useI18nNamespace(menuMessages)
}

export function useCommandMessages() {
  return useI18nNamespace(commandMessages)
}

export function useToolMessages() {
  return useI18nNamespace(toolMessages)
}

export function usePanelMessages() {
  return useI18nNamespace(panelMessages)
}

export function useVariableTypeMessages() {
  return useI18nNamespace(variableTypeMessages)
}

export function usePageMessages() {
  return useI18nNamespace(pageMessages)
}

export function useDialogMessages() {
  return useI18nNamespace(dialogMessages)
}

export function useI18n() {
  return {
    menu: useMenuMessages(),
    commands: useCommandMessages(),
    tools: useToolMessages(),
    panels: usePanelMessages(),
    variableTypes: useVariableTypeMessages(),
    pages: usePageMessages(),
    dialogs: useDialogMessages(),
    locale: useStore(locale) as Ref<Locale>,
    availableLocales: AVAILABLE_LOCALES,
    localeLabels: LOCALE_LABELS,
    setLocale
  }
}
