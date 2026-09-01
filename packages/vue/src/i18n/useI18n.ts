import { useStore } from '@nanostores/vue'
import type { Store, StoreValue } from 'nanostores'
import type { Ref } from 'vue'

import { locale, setLocale, AVAILABLE_LOCALES, LOCALE_LABELS } from '#vue/i18n/locale'
import type { Locale } from '#vue/i18n/locale'
import {
  aiMessages,
  automationMessages,
  codeMessages,
  collaborationMessages,
  commandMessages,
  commonMessages,
  credentialsMessages,
  diagnosticsMessages,
  editorMessages,
  filesMessages,
  fontsMessages,
  mediaMessages,
  menuMessages,
  pageMessages,
  panelMessages,
  recoveryMessages,
  renderingMessages,
  renameMessages,
  settingsMessages,
  storageMessages,
  toolMessages,
  updatesMessages,
  variablesMessages,
  variableTypeMessages
} from '#vue/i18n/messages'

export function useI18nNamespace<MessagesStore extends Store>(messages: MessagesStore) {
  return useStore(messages) as Ref<StoreValue<MessagesStore>>
}

export const useAIMessages = () => useI18nNamespace(aiMessages)
export const useAutomationMessages = () => useI18nNamespace(automationMessages)
export const useCodeMessages = () => useI18nNamespace(codeMessages)
export const useCollaborationMessages = () => useI18nNamespace(collaborationMessages)
export const useCommandMessages = () => useI18nNamespace(commandMessages)
export const useCommonMessages = () => useI18nNamespace(commonMessages)
export const useCredentialMessages = () => useI18nNamespace(credentialsMessages)
export const useDiagnosticsMessages = () => useI18nNamespace(diagnosticsMessages)
export const useEditorMessages = () => useI18nNamespace(editorMessages)
export const useFileMessages = () => useI18nNamespace(filesMessages)
export const useFontMessages = () => useI18nNamespace(fontsMessages)
export const useMediaMessages = () => useI18nNamespace(mediaMessages)
export const useMenuMessages = () => useI18nNamespace(menuMessages)
export const usePageMessages = () => useI18nNamespace(pageMessages)
export const usePanelMessages = () => useI18nNamespace(panelMessages)
export const useRecoveryMessages = () => useI18nNamespace(recoveryMessages)
export const useRenderingMessages = () => useI18nNamespace(renderingMessages)
export const useRenameMessages = () => useI18nNamespace(renameMessages)
export const useSettingsMessages = () => useI18nNamespace(settingsMessages)
export const useStorageMessages = () => useI18nNamespace(storageMessages)
export const useToolMessages = () => useI18nNamespace(toolMessages)
export const useUpdateMessages = () => useI18nNamespace(updatesMessages)
export const useVariableMessages = () => useI18nNamespace(variablesMessages)
export const useVariableTypeMessages = () => useI18nNamespace(variableTypeMessages)

/** Compatibility aggregate. New code should import the narrow domain composable. */
export function useI18n() {
  return {
    ai: useAIMessages(),
    automation: useAutomationMessages(),
    code: useCodeMessages(),
    collaboration: useCollaborationMessages(),
    commands: useCommandMessages(),
    common: useCommonMessages(),
    credentials: useCredentialMessages(),
    diagnostics: useDiagnosticsMessages(),
    editor: useEditorMessages(),
    files: useFileMessages(),
    fonts: useFontMessages(),
    media: useMediaMessages(),
    menu: useMenuMessages(),
    pages: usePageMessages(),
    panels: usePanelMessages(),
    recovery: useRecoveryMessages(),
    rendering: useRenderingMessages(),
    rename: useRenameMessages(),
    settings: useSettingsMessages(),
    storage: useStorageMessages(),
    tools: useToolMessages(),
    updates: useUpdateMessages(),
    variables: useVariableMessages(),
    variableTypes: useVariableTypeMessages(),
    locale: useStore(locale) as Ref<Locale>,
    availableLocales: AVAILABLE_LOCALES,
    localeLabels: LOCALE_LABELS,
    setLocale
  }
}
