import { ref } from 'vue'

import { errorMessage } from '@open-pencil/std/errors'

import { openWebAddress, parseWebAddress } from './open'

/** Whether File → Open from URL… is showing its dialog. */
export const openURLDialogOpen = ref(false)

export function showOpenURLDialog(): void {
  openURLDialogOpen.value = true
}

/**
 * Opens the address the dialog was given. Resolves with why it could not, for the dialog to show,
 * or null once it opened. When `signal` aborts, as closing the dialog does, it stops before opening
 * anything and resolves with null.
 */
export async function submitOpenURL(text: string, signal: AbortSignal): Promise<string | null> {
  const url = parseWebAddress(text)
  if (!url) return null
  try {
    await openWebAddress(url, signal)
    return null
  } catch (error) {
    if (signal.aborted) return null
    return errorMessage(error)
  }
}
