import { useIntervalFn } from '@vueuse/core'

const RECENT_WRITE_MS = 1000
const BROWSER_POLL_MS = 2000
const TAURI_WATCH_DELAY_MS = 500

export async function watchTauriFile(
  filePath: string,
  getLastWriteTime: () => number,
  reloadFromDisk: () => void
) {
  const { watch: tauriWatch } = await import('@tauri-apps/plugin-fs')
  const unwatch = await tauriWatch(
    filePath,
    (event) => {
      if (typeof event.type !== 'object' || !('modify' in event.type)) return
      if (Date.now() - getLastWriteTime() < RECENT_WRITE_MS) return
      reloadFromDisk()
    },
    { delayMs: TAURI_WATCH_DELAY_MS }
  )
  return () => unwatch()
}

export async function watchBrowserFile(
  fileHandle: FileSystemFileHandle,
  getActiveFileHandle: () => FileSystemFileHandle | null,
  getLastWriteTime: () => number,
  reloadFromDisk: () => void,
  stopWatchingFile: () => void
) {
  let lastModified = (await fileHandle.getFile()).lastModified
  const { pause, resume } = useIntervalFn(
    () => {
      void checkBrowserFileModified(fileHandle)
    },
    BROWSER_POLL_MS,
    { immediate: false }
  )
  resume()

  async function checkBrowserFileModified(handle: FileSystemFileHandle) {
    if (getActiveFileHandle() !== handle) {
      stopWatchingFile()
      return
    }
    try {
      const file = await handle.getFile()
      if (file.lastModified > lastModified) {
        lastModified = file.lastModified
        if (Date.now() - getLastWriteTime() < RECENT_WRITE_MS) return
        reloadFromDisk()
      }
    } catch {
      stopWatchingFile()
    }
  }

  return pause
}
