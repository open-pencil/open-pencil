import { readFile as tauriRead } from '@tauri-apps/plugin-fs'

import { parseFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'

import { isTauri } from '@/app/tauri/env'

export type ReloadSourceOptions = {
  filePath: string | null
  fileHandle: FileSystemFileHandle | null
  signal?: AbortSignal
}

export async function readReloadSource({ filePath, fileHandle, signal }: ReloadSourceOptions) {
  signal?.throwIfAborted()
  if (filePath && isTauri()) {
    const bytes = await tauriRead(filePath)
    signal?.throwIfAborted()
    // Parsed from the bytes as read: copying them into a Blob and a File first held the file
    // three more times while the open document was still in memory.
    const buffer =
      bytes.buffer instanceof ArrayBuffer && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.slice().buffer
    return parseFigFile(buffer, { populate: 'first-page', signal })
  }

  if (fileHandle) {
    const file = await fileHandle.getFile()
    signal?.throwIfAborted()
    return readFigFile(file, { populate: 'first-page', signal })
  }

  return null
}
