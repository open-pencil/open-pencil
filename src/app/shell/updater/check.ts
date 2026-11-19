import { promiseTimeout } from '@vueuse/core'
import type { Ref } from 'vue'

import { errorMessage } from '@open-pencil/std/errors'

import { appPreferences } from '@/app/settings/preferences/store'
import { toast } from '@/app/shell/ui'
import { canSelfUpdate } from '@/app/tauri/capabilities'

import { resolveUpdateChannel } from './channel'
import { checkUpdateChannel } from './feed'
import { updateFailureText, type UpdaterMessages } from './messages'
import { openUpdaterWindow } from './window'

export const STARTUP_UPDATE_CHECK_DELAY_MS = 2500

interface UpdateCheckOptions {
  silent?: boolean
  messages: Ref<UpdaterMessages>
}

let startupCheckStarted = false
let updateCheckInFlight: Promise<void> | null = null
/** Whether the check in flight shows its outcome: one the person asked for joined it. */
let reportInFlight = false

export async function checkForAppUpdate(options: UpdateCheckOptions) {
  // Off in the browser and in packages whose store delivers updates.
  if (!canSelfUpdate()) return
  const { silent = false, messages } = options
  // A Check for Updates while the launch check runs shares its answer and still shows it.
  if (!silent) reportInFlight = true
  if (updateCheckInFlight) return updateCheckInFlight

  updateCheckInFlight = runUpdateCheck(messages).finally(() => {
    updateCheckInFlight = null
    reportInFlight = false
  })
  return updateCheckInFlight
}

export async function scheduleStartupUpdateCheck(messages: Ref<UpdaterMessages>): Promise<void> {
  if (startupCheckStarted || !canSelfUpdate()) return
  startupCheckStarted = true
  await promiseTimeout(STARTUP_UPDATE_CHECK_DELAY_MS)
  // Read after the delay so a switch flipped during it still skips the request.
  // Check for Updates calls checkForAppUpdate and does not look at this preference.
  if (appPreferences.value.updates.checkOnStartup) {
    await checkForAppUpdate({ silent: true, messages })
  }
}

/** Lets tests schedule the launch check more than once. */
export function resetStartupUpdateCheckForTests(): void {
  startupCheckStarted = false
}

// The main window only learns whether an update exists; the Software Update
// window checks again for its own handle, then shows the notes and installs.
async function runUpdateCheck(messages: Ref<UpdaterMessages>) {
  try {
    const update = await checkUpdateChannel(
      resolveUpdateChannel(appPreferences.value.updates.channel)
    )
    if (!update) {
      if (reportInFlight) toast.info(messages.value.upToDate)
      return
    }
    await update.close()
    await openUpdaterWindow(messages.value.windowTitle)
  } catch (error) {
    if (reportInFlight) {
      const message = errorMessage(error)
      toast.warning(updateFailureText(messages.value, 'check', message))
    }
  }
}
