import { promiseTimeout } from '@vueuse/core'

import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'

import type { Ref } from 'vue'

const STARTUP_UPDATE_CHECK_DELAY_MS = 2500

interface UpdaterMessages {
  appUpToDate: string
  updateAvailableTitle: string
  updateAvailable: (params: { version: string }) => string
  updateInstallPrompt: string
  downloadingUpdate: (params: { version: string }) => string
  updateInstalledTitle: string
  updateInstalled: (params: { version: string; size: string }) => string
  updateUnavailable: string
  updateCheckFailed: (params: { error: string }) => string
}

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

async function runUpdateCheck(silent: boolean, messages: Ref<UpdaterMessages>) {
  try {
    const [{ check }, { confirm, message }, { relaunch }] = await Promise.all([
      import('@tauri-apps/plugin-updater'),
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-process')
    ])

    const update = await check()
    const t = messages.value

    if (!update) {
      if (!silent) toast.info(t.appUpToDate)
      return
    }

    const details = [
      t.updateAvailable({ version: update.version }),
      update.body ? `\n${update.body}` : '',
      `\n${t.updateInstallPrompt}`
    ].join('')

    const shouldInstall = await confirm(details, {
      title: t.updateAvailableTitle,
      kind: 'info'
    })

    if (!shouldInstall) return

    let downloaded = 0
    let contentLength: number | undefined
    toast.info(t.downloadingUpdate({ version: update.version }))

    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength
        return
      }
      if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      }
    })

    const sizeLabel = contentLength
      ? ` (${formatBytes(downloaded)} of ${formatBytes(contentLength)})`
      : ''
    await message(t.updateInstalled({ version: update.version, size: sizeLabel }), {
      title: t.updateInstalledTitle,
      kind: 'info'
    })
    await relaunch()
  } catch (error) {
    if (!silent) {
      const message = error instanceof Error ? error.message : String(error)
      toast.warning(
        isMissingUpdateManifestError(message)
          ? messages.value.updateUnavailable
          : messages.value.updateCheckFailed({ error: message })
      )
    }
  }
}

function isMissingUpdateManifestError(message: string) {
  return message.toLowerCase().includes('valid release json')
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  return `${(kib / 1024).toFixed(1)} MiB`
}
