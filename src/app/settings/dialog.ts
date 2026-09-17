import { ref } from 'vue'

export type SettingsSection =
  | 'general'
  | 'ai'
  | 'usage'
  | 'diagnostics'
  | 'mcp'
  | 'tools'
  | 'media'
  | 'storage'

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('general')

type SettingsNavigationRequest = (action: () => void) => void
let requestNavigation: SettingsNavigationRequest | null = null

export function registerSettingsNavigation(request: SettingsNavigationRequest) {
  requestNavigation = request
  return () => {
    if (requestNavigation === request) requestNavigation = null
  }
}

export function openSettingsDialog(section?: SettingsSection): void {
  if (settingsDialogOpen.value && (!section || section === settingsDialogSection.value)) return
  const open = () => {
    if (section) settingsDialogSection.value = section
    settingsDialogOpen.value = true
  }
  if (settingsDialogOpen.value && requestNavigation) requestNavigation(open)
  else open()
}
