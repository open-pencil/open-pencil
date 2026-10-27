import { ref } from 'vue'

/** The Settings window's pages, in the sidebar's groups: App, AI, Data & privacy. */
export type SettingsSection =
  | 'general'
  | 'editor'
  | 'fonts'
  | 'storage'
  | 'cloud'
  | 'ai'
  | 'tools'
  | 'skills'
  | 'services'
  | 'mcp'
  | 'usage'
  | 'privacy'
  | 'diagnostics'

/** A part of a page that opening Settings scrolls to, such as the toolbar on the Editor page. */
export type SettingsAnchor = 'toolbar'

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('general')
/** The part of the open page to bring into view; the page clears it once shown. */
export const settingsDialogAnchor = ref<SettingsAnchor | null>(null)

type SettingsNavigationRequest = (action: () => void) => void
let requestNavigation: SettingsNavigationRequest | null = null

export function registerSettingsNavigation(request: SettingsNavigationRequest) {
  requestNavigation = request
  return () => {
    if (requestNavigation === request) requestNavigation = null
  }
}

export function openSettingsDialog(section?: SettingsSection, anchor?: SettingsAnchor): void {
  const open = () => {
    if (section) settingsDialogSection.value = section
    settingsDialogAnchor.value = anchor ?? null
    settingsDialogOpen.value = true
  }
  if (settingsDialogOpen.value && (!section || section === settingsDialogSection.value)) {
    if (anchor) settingsDialogAnchor.value = anchor
    return
  }
  if (settingsDialogOpen.value && requestNavigation) requestNavigation(open)
  else open()
}
