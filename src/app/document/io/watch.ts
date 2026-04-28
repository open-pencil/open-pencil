import { watchBrowserFile, watchTauriFile } from '@/app/document/io/watch-targets'
import { IS_TAURI } from '@/constants'

type FileWatchOptions = {
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getLastWriteTime: () => number
  reloadFromDisk: () => void
}

export function createFileWatcher({
  getFilePath,
  getFileHandle,
  getLastWriteTime,
  reloadFromDisk
}: FileWatchOptions) {
  let unwatchFile: (() => void) | null = null

  function stopWatchingFile() {
    if (unwatchFile) {
      unwatchFile()
      unwatchFile = null
    }
  }

  async function startWatchingFile() {
    stopWatchingFile()
    const filePath = getFilePath()
    const fileHandle = getFileHandle()

    if (filePath && IS_TAURI) {
      unwatchFile = await watchTauriFile(filePath, getLastWriteTime, reloadFromDisk)
    } else if (fileHandle) {
      unwatchFile = await watchBrowserFile(
        fileHandle,
        getFileHandle,
        getLastWriteTime,
        reloadFromDisk,
        stopWatchingFile
      )
    }
  }

  return { startWatchingFile, stopWatchingFile }
}
