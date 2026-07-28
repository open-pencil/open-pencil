import { ref } from 'vue'

export type SettingsSection = 'ai' | 'media' | 'storage'

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('ai')

export function openSettingsDialog(section: SettingsSection = 'ai'): void {
  settingsDialogSection.value = section
  settingsDialogOpen.value = true
}
