import { readFigFile } from '@open-pencil/core/io/formats/fig'

import { isTauri } from '@/app/tauri/env'

export type ReloadSourceOptions = {
  documentName: string
  filePath: string | null
  fileHandle: FileSystemFileHandle | null
}

export async function readReloadSource({
  documentName,
  filePath,
  fileHandle
}: ReloadSourceOptions) {
  if (filePath && isTauri()) {
    const { readFile: tauriRead } = await import('@tauri-apps/plugin-fs')
    const bytes = await tauriRead(filePath)
    const blob = new Blob([bytes])
    const file = new File([blob], `${documentName}.fig`)
    return readFigFile(file, { populate: 'first-page' })
  }

  if (fileHandle) {
    const file = await fileHandle.getFile()
    return readFigFile(file, { populate: 'first-page' })
  }

  return null
}
