import { promiseTimeout } from '@vueuse/core'
import type { Ref } from 'vue'

import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'

import { updateFailureText, type UpdaterMessages } from './messages'
import { openUpdaterWindow } from './window'

const STARTUP_UPDATE_CHECK_DELAY_MS = 2500

interface UpdateCheckOptions {
  silent?: boolean
  messages: Ref<UpdaterMessages>
}

let startupCheckStarted = false
let updateCheckInFlight: Promise<void> | null = null

export async function checkForAppUpdate(options: UpdateCheckOptions) {
  if (!isTauri()) return
  if (updateCheckInFlight) return updateCheckInFlight

  const { silent = false, messages } = options
  updateCheckInFlight = runUpdateCheck(silent, messages).finally(() => {
    updateCheckInFlight = null
  })
  return updateCheckInFlight
}

export function scheduleStartupUpdateCheck(messages: Ref<UpdaterMessages>) {
  if (startupCheckStarted || !isTauri()) return
  startupCheckStarted = true
  void promiseTimeout(STARTUP_UPDATE_CHECK_DELAY_MS).then(() =>
    checkForAppUpdate({ silent: true, messages })
  )
}

// The main window only learns whether an update exists; the Software Update
// window checks again for its own handle, then shows the notes and installs.
async function runUpdateCheck(silent: boolean, messages: Ref<UpdaterMessages>) {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) {
      if (!silent) toast.info(messages.value.upToDate)
      return
    }
    await update.close()
    await openUpdaterWindow(messages.value.windowTitle)
  } catch (error) {
    if (!silent) {
      const message = error instanceof Error ? error.message : String(error)
      toast.warning(updateFailureText(messages.value, 'check', message))
    }
  }
}
