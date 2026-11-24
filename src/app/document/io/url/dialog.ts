import { ref } from 'vue'

import { errorMessage, isAbortError } from '@open-pencil/std/errors'
import { messageStores } from '@open-pencil/vue/i18n'

import { notificationMessages } from '@/app/i18n/notifications'
import { appPreferences } from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'

import { fetchWebAddress, openRemoteFile, parseWebAddress, type OpenableRemoteFile } from './open'
import { WEB_PAGE_VIEWPORTS } from './viewport'

/** Whether File → Open from URL… is showing its dialog. */
export const openURLDialogOpen = ref(false)

export function showOpenURLDialog(): void {
  openURLDialogOpen.value = true
}

/**
 * Reads the address the dialog was given, and once it holds something OpenPencil opens, opens it
 * in a tab of its own with the size and scripts setting the dialog last chose; that tab shows how
 * far the open has got, and closing it cancels the open. Resolves with why the address could not
 * be read or opened, for the dialog to show, or null once the open has started. When `signal`
 * aborts, as closing the dialog does, it stops before opening anything and resolves with null.
 */
export async function submitOpenURL(text: string, signal: AbortSignal): Promise<string | null> {
  const url = parseWebAddress(text)
  if (!url) return null
  let remote: OpenableRemoteFile
  try {
    remote = await fetchWebAddress(url, signal)
  } catch (error) {
    if (signal.aborted) return null
    return errorMessage(error)
  }
  if (signal.aborted) return null
  const { webPageSize, runPageScripts } = appPreferences.value.import
  // Kept in the dialog, so its scripts setting can be turned on and the address tried again.
  if (remote.rendersOnly && !runPageScripts) return messageStores.files.get().openURLRefused
  void openRemoteFile(remote, {
    viewport: WEB_PAGE_VIEWPORTS[webPageSize],
    runScripts: runPageScripts
  }).catch((error: unknown) => {
    // Closing the tab cancels the open, which is no failure.
    if (isAbortError(error)) return
    toast.error(
      notificationMessages.get().openFileFailed({ name: remote.title, error: errorMessage(error) })
    )
  })
  return null
}
