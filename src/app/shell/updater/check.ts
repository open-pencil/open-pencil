import { check } from '@tauri-apps/plugin-updater'
import { promiseTimeout } from '@vueuse/core'
import type { Ref } from 'vue'

import { IS_MOBILE_APP } from '@lawha/core/constants'

import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'

import { updateFailureText, type UpdaterMessages } from './messages'
import { checkForMobileUpdate } from './mobile'
import { openUpdaterWindow } from './window'

const STARTUP_UPDATE_CHECK_DELAY_MS = 2500

interface UpdateCheckOptions {
  silent?: boolean
  messages: Ref<UpdaterMessages>
}

let startupCheckStarted = false
let updateCheckInFlight: Promise<void> | null = null

/**
 * On: tauri.conf.json carries this product's own signing key and points at its own release
 * (`desktop-preview`, published by .github/workflows/desktop-preview.yml). An object, not a
 * constant, so tests can turn it off.
 */
export const updaterSettings = { enabled: true }

export async function checkForAppUpdate(options: UpdateCheckOptions) {
  if (!updaterSettings.enabled || !isTauri()) return
  if (updateCheckInFlight) return updateCheckInFlight

  const { silent = false, messages } = options
  updateCheckInFlight = runUpdateCheck(silent, messages).finally(() => {
    updateCheckInFlight = null
  })
  return updateCheckInFlight
}

export function scheduleStartupUpdateCheck(messages: Ref<UpdaterMessages>) {
  if (IS_MOBILE_APP && !startupCheckStarted) {
    startupCheckStarted = true
    void promiseTimeout(STARTUP_UPDATE_CHECK_DELAY_MS).then(() => checkForMobileUpdate(messages))
    return
  }
  if (!updaterSettings.enabled || startupCheckStarted || !isTauri()) return
  startupCheckStarted = true
  void promiseTimeout(STARTUP_UPDATE_CHECK_DELAY_MS).then(() =>
    checkForAppUpdate({ silent: true, messages })
  )
}

// The main window only learns whether an update exists; the Software Update
// window checks again for its own handle, then shows the notes and installs.
async function runUpdateCheck(silent: boolean, messages: Ref<UpdaterMessages>) {
  try {
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
