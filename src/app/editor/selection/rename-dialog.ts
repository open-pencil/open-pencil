import { ref } from 'vue'

export const renameSelectionOpen = ref(false)

export function openRenameSelectionDialog(): void {
  renameSelectionOpen.value = true
}
