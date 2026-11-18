import { ref } from 'vue'

import { openWebAddress, parseWebAddress } from './open'

/** Whether File → Open from URL… is showing its dialog. */
export const openURLDialogOpen = ref(false)

export function showOpenURLDialog(): void {
  openURLDialogOpen.value = true
}

/**
 * Opens the address the dialog was given and closes the dialog once it opened. Resolves with why
 * it could not, for the dialog to show, or null.
 */
export async function submitOpenURL(text: string): Promise<string | null> {
  const url = parseWebAddress(text)
  if (!url) return null
  try {
    await openWebAddress(url)
    openURLDialogOpen.value = false
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
