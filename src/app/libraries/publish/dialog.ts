import { ref } from 'vue'

export const publishLibraryDialogOpen = ref(false)

export function openPublishLibraryDialog(): void {
  publishLibraryDialogOpen.value = true
}
