import type { DownloadEvent } from '@tauri-apps/plugin-updater'
import { shallowRef, type ShallowRef } from 'vue'

import type { UpdateFailureStep } from './messages'
import type { DownloadProgress } from './progress'
import { requestRestartApproval } from './restart'

export interface ReleaseInfo {
  version: string
  currentVersion: string
  /** The release's `CHANGELOG.md` section, as Markdown. */
  notes: string
}

export type UpdaterState =
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; release: ReleaseInfo }
  | { status: 'downloading'; release: ReleaseInfo; progress: DownloadProgress }
  | { status: 'installing'; release: ReleaseInfo }
  /** Installed on disk (macOS and Linux); it runs once the app restarts. */
  | { status: 'installed'; release: ReleaseInfo }
  | { status: 'failed'; step: UpdateFailureStep; release?: ReleaseInfo; error: string }

/** The slice of a Tauri `Update` the window uses. */
export interface PendingUpdate {
  version: string
  currentVersion: string
  body?: string
  download(onEvent: (event: DownloadEvent) => void): Promise<void>
  install(): Promise<void>
  close(): Promise<void>
}

export interface UpdaterBackend {
  check(): Promise<PendingUpdate | null>
  /** Asks the editor to close its documents, as Quit does; true once they agreed. */
  confirmRestart(): Promise<boolean>
  relaunch(): Promise<void>
  closeWindow(): Promise<void>
  /** Windows installers quit the app themselves, so documents must close before installing. */
  installQuitsApp: boolean
}

export interface UpdaterSession {
  state: ShallowRef<UpdaterState>
  check(): Promise<void>
  install(): Promise<void>
  /** Stops showing the download; it keeps running and a later install reuses it. */
  cancel(): void
  restart(): Promise<void>
  /** Repeats the step that failed. */
  retry(): Promise<void>
  dismiss(): Promise<void>
}

interface Download {
  done: Promise<void>
  progress: DownloadProgress
}

export function createUpdaterSession(backend: UpdaterBackend): UpdaterSession {
  const state = shallowRef<UpdaterState>({ status: 'checking' })
  let pending: PendingUpdate | null = null
  // Tauri cannot abort a download, so cancelling only detaches the window from it.
  let download: Download | null = null
  let attachedTo: Download | null = null

  async function release() {
    const update = pending
    pending = null
    download = null
    attachedTo = null
    await update?.close()
  }

  async function check() {
    state.value = { status: 'checking' }
    try {
      await release()
      pending = await backend.check()
      state.value = pending
        ? { status: 'available', release: releaseInfo(pending) }
        : { status: 'up-to-date' }
    } catch (error) {
      state.value = { status: 'failed', step: 'check', error: errorMessage(error) }
    }
  }

  function startDownload(update: PendingUpdate): Download {
    const progress: DownloadProgress = { downloaded: 0 }
    const info = releaseInfo(update)
    const current: Download = {
      progress,
      done: update.download((event) => {
        if (event.event === 'Started') progress.total = event.data.contentLength
        else if (event.event === 'Progress') progress.downloaded += event.data.chunkLength
        else return
        if (attachedTo === current) {
          state.value = { status: 'downloading', release: info, progress: { ...progress } }
        }
      })
    }
    // A failed download is never reused; the next install starts another.
    current.done.catch(() => {
      if (download === current) download = null
    })
    return current
  }

  // A function, so the check reads the current value after an await.
  function isAttached(target: Download): boolean {
    return attachedTo === target
  }

  async function install() {
    const update = pending
    const current = state.value
    if (!update || (current.status !== 'available' && current.status !== 'failed')) return
    const info = releaseInfo(update)

    download ??= startDownload(update)
    const active = download
    attachedTo = active
    state.value = { status: 'downloading', release: info, progress: { ...active.progress } }

    try {
      await active.done
    } catch (error) {
      if (isAttached(active)) {
        attachedTo = null
        state.value = {
          status: 'failed',
          step: 'download',
          release: info,
          error: errorMessage(error)
        }
      }
      return
    }
    if (!isAttached(active)) return

    if (backend.installQuitsApp) {
      // The installer quits the app, so the editor's documents must agree to close first.
      let approved: boolean
      try {
        approved = await backend.confirmRestart()
      } catch (error) {
        if (isAttached(active)) {
          state.value = {
            status: 'failed',
            step: 'install',
            release: info,
            error: errorMessage(error)
          }
        }
        attachedTo = null
        return
      }
      // Cancel or Later while the editor was asking wins over a late approval.
      if (!isAttached(active)) return
      if (!approved) {
        attachedTo = null
        state.value = { status: 'available', release: info }
        return
      }
    }
    attachedTo = null

    state.value = { status: 'installing', release: info }
    try {
      await update.install()
    } catch (error) {
      download = null
      state.value = { status: 'failed', step: 'install', release: info, error: errorMessage(error) }
      return
    }
    state.value = { status: 'installed', release: info }
  }

  function cancel() {
    const current = state.value
    if (current.status !== 'downloading') return
    attachedTo = null
    state.value = { status: 'available', release: current.release }
  }

  let restarting = false

  async function restart() {
    const current = state.value
    if (current.status !== 'installed' || restarting) return
    restarting = true
    try {
      if (!(await backend.confirmRestart())) return
      await backend.relaunch()
    } catch (error) {
      state.value = {
        status: 'failed',
        step: 'restart',
        release: current.release,
        error: errorMessage(error)
      }
    } finally {
      restarting = false
    }
  }

  async function retry() {
    const current = state.value
    if (current.status !== 'failed') return
    if (!current.release || !pending || current.step === 'check') return check()
    if (current.step === 'restart') {
      state.value = { status: 'installed', release: current.release }
      return restart()
    }
    return install()
  }

  async function dismiss() {
    if (state.value.status === 'installing') return
    await release()
    await backend.closeWindow()
  }

  return { state, check, install, cancel, restart, retry, dismiss }
}

function releaseInfo(update: PendingUpdate): ReleaseInfo {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body?.trim() ?? ''
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createTauriUpdaterBackend(): UpdaterBackend {
  return {
    async check() {
      const { check } = await import('@tauri-apps/plugin-updater')
      return check()
    },
    confirmRestart: requestRestartApproval,
    async relaunch() {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
    async closeWindow() {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().close()
    },
    installQuitsApp: navigator.userAgent.includes('Windows')
  }
}
