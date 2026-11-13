import { watch as tauriWatch } from '@tauri-apps/plugin-fs'
import { useIntervalFn } from '@vueuse/core'

const TAURI_RECENT_WRITE_MS = 1000
const BROWSER_POLL_MS = 2000
// The browser polls, so a save completed just before a poll must still look recent when it
// lands on the next one; a window shorter than the poll would let the save trigger a reload.
const BROWSER_RECENT_WRITE_MS = BROWSER_POLL_MS + 1000
const TAURI_WATCH_DELAY_MS = 500

export async function watchTauriFile(
  filePath: string,
  getLastWriteTime: () => number,
  reloadFromDisk: () => void
) {
  const unwatch = await tauriWatch(
    filePath,
    (event) => {
      if (typeof event.type !== 'object' || !('modify' in event.type)) return
      // macOS rewrites a file's metadata, such as its last-used date, when it is opened; only a
      // change to its contents means the document on screen is out of date.
      if (event.type.modify.kind === 'metadata') return
      if (Date.now() - getLastWriteTime() < TAURI_RECENT_WRITE_MS) return
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
        if (Date.now() - getLastWriteTime() < BROWSER_RECENT_WRITE_MS) return
        reloadFromDisk()
      }
    } catch {
      stopWatchingFile()
    }
  }

  return pause
}
