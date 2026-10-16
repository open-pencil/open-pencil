import { readFile as tauriRead } from '@tauri-apps/plugin-fs'

import { parseFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'

import { rememberLoadedRevision } from '@/app/document/io/revision'
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
    // shortcut: no loaded revision is kept, so revision-checked links report stale until reopened;
    // hash these bytes here if reloaded desktop documents must keep matching revisions.
    const buffer =
      bytes.buffer instanceof ArrayBuffer && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.slice().buffer
    return parseFigFile(buffer, { populate: 'first-page', signal })
  }

  if (fileHandle) {
    const file = await fileHandle.getFile()
    signal?.throwIfAborted()
    const graph = await readFigFile(file, { populate: 'first-page', signal })
    rememberLoadedRevision(graph, file)
    return graph
  }

  return null
}
