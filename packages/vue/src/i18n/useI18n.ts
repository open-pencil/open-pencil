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
  commentMessages,
  commonMessages,
  credentialsMessages,
  designCheckMessages,
  diagnosticsMessages,
  editorMessages,
  figJamMessages,
  filesMessages,
  fontsMessages,
  livePageMessages,
  mediaMessages,
  menuMessages,
  pageMessages,
  panelMessages,
  projectsMessages,
  recoveryMessages,
  renameMessages,
  settingsMessages,
  shapeMessages,
  sourceControlMessages,
  statusMessages,
  storageMessages,
  toolMessages,
  updatesMessages,
  cloudMessages,
  cloudPortalMessages,
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
export const useCommentMessages = () => useI18nNamespace(commentMessages)
export const useCommonMessages = () => useI18nNamespace(commonMessages)
export const useCredentialMessages = () => useI18nNamespace(credentialsMessages)
export const useDesignCheckMessages = () => useI18nNamespace(designCheckMessages)
export const useDiagnosticsMessages = () => useI18nNamespace(diagnosticsMessages)
export const useEditorMessages = () => useI18nNamespace(editorMessages)
export const useFigJamMessages = () => useI18nNamespace(figJamMessages)
export const useFileMessages = () => useI18nNamespace(filesMessages)
export const useFontMessages = () => useI18nNamespace(fontsMessages)
export const useLivePageMessages = () => useI18nNamespace(livePageMessages)
export const useMediaMessages = () => useI18nNamespace(mediaMessages)
export const useMenuMessages = () => useI18nNamespace(menuMessages)
export const usePageMessages = () => useI18nNamespace(pageMessages)
export const usePanelMessages = () => useI18nNamespace(panelMessages)
export const useProjectMessages = () => useI18nNamespace(projectsMessages)
export const useRecoveryMessages = () => useI18nNamespace(recoveryMessages)
export const useRenameMessages = () => useI18nNamespace(renameMessages)
export const useSettingsMessages = () => useI18nNamespace(settingsMessages)
export const useShapeMessages = () => useI18nNamespace(shapeMessages)
export const useSourceControlMessages = () => useI18nNamespace(sourceControlMessages)
export const useStatusMessages = () => useI18nNamespace(statusMessages)
export const useStorageMessages = () => useI18nNamespace(storageMessages)
export const useToolMessages = () => useI18nNamespace(toolMessages)
export const useUpdateMessages = () => useI18nNamespace(updatesMessages)
export const useCloudMessages = () => useI18nNamespace(cloudMessages)
export const useCloudPortalMessages = () => useI18nNamespace(cloudPortalMessages)
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
    livePages: useLivePageMessages(),
    media: useMediaMessages(),
    menu: useMenuMessages(),
    pages: usePageMessages(),
    panels: usePanelMessages(),
    recovery: useRecoveryMessages(),
    rename: useRenameMessages(),
    settings: useSettingsMessages(),
    sourceControl: useSourceControlMessages(),
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
