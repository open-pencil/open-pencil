import { ref } from 'vue'

export type SettingsSection =
  | 'general'
  | 'ai'
  | 'usage'
  | 'diagnostics'
  | 'mcp'
  | 'media'
  | 'storage'

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('general')

export function openSettingsDialog(section?: SettingsSection): void {
  if (section) settingsDialogSection.value = section
  settingsDialogOpen.value = true
}
