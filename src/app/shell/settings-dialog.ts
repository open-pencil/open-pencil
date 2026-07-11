import { ref } from 'vue'

export type SettingsTab = 'cloud' | 'ai'

/** Open state of the global Settings dialog — shared so any screen can deep-link into it. */
export const settingsDialogOpen = ref(false)

/** Active tab of the Settings dialog — shared so deep-links can land on a specific tab. */
export const settingsDialogTab = ref<SettingsTab>('cloud')

/** Open the Settings dialog on a specific tab (e.g. the chat panel's connect button). */
export function openSettingsDialog(tab: SettingsTab = 'cloud') {
  settingsDialogTab.value = tab
  settingsDialogOpen.value = true
}
