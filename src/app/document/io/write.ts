import { invoke } from '@tauri-apps/api/core'
import { appCacheDir } from '@tauri-apps/api/path'
import { BaseDirectory, remove, writeFile as tauriWrite } from '@tauri-apps/plugin-fs'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { storageLocationOf } from '@/app/integrations/storage/location'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { isAndroid, isTauri } from '@/app/tauri/env'

type WriteDocumentState = { documentName: string }

/** Distinguishes staging files written within the same millisecond. */
let stagingWrites = 0

/**
 * Writes a saved document into a file the user picked with the system "save as" sheet.
 *
 * That picker hands back a `content://` URI, and the fs plugin resolves paths with
 * `std::fs`, which cannot open one. The webview stages the bytes in the cache directory
 * and the platform copies them through its ContentResolver — sending a multi-megabyte
 * design file over IPC would be slow and memory-hungry on a device.
 */
async function writeToAndroidDocument(uri: string, data: Uint8Array): Promise<void> {
  // Each save stages its own file: nothing serializes two saves around this name, and a
  // shared one would let the first one's cleanup delete the bytes the second one is copying.
  stagingWrites += 1
  const name = `openpencil-save-${Date.now()}-${stagingWrites}.fig`
  // The write itself is inside the guard: a full disk fails there rather than in the copy,
  // and a staged file left behind by that failure would never be cleaned up.
  try {
    await tauriWrite(name, data, { baseDir: BaseDirectory.Cache })
    await invoke('write_content_uri', {
      uri,
      sourcePath: `${await appCacheDir()}/${name}`
    })
  } finally {
    await remove(name, { baseDir: BaseDirectory.Cache }).catch(() => undefined)
  }
}

/**
 * The name the picked document has in its provider, such as `Final.fig`.
 *
 * A `content://` URI carries no name of its own, and the save sheet lets the person rename
 * the file, so the editor asks the provider rather than keeping the previous name. Some
 * providers answer with nothing at all, and the document id is then the only source left —
 * it usually still ends in the name that was typed, as `primary:Download/Final.fig` does.
 */
export async function androidDocumentName(uri: string): Promise<string | null> {
  // A provider that refuses the query leaves the URI as the only source of the name.
  const name = await invoke<string>('content_uri_display_name', { uri }).catch(() => null)
  return name || nameFromDocumentURI(uri)
}

/** The file name a document URI still carries, decoded, or `null` when it carries none. */
function nameFromDocumentURI(uri: string): string | null {
  const withoutQuery = uri.split('?')[0] ?? ''
  const lastSegment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1)
  if (!lastSegment) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(lastSegment)
  } catch {
    return null
  }

  // A document id reads `primary:Download/Final.fig`: the volume ends at the first colon
  // and the name follows the last slash, so an id with neither keeps the name it was.
  const afterVolume = decoded.slice(decoded.indexOf(':') + 1)
  const name = afterVolume.slice(afterVolume.lastIndexOf('/') + 1)
  return name || null
}

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  onWriteSuccess?: (version: number) => void | Promise<void>
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  getStorageBinding,
  setSavedVersion,
  setLastWriteTime,
  onWriteSuccess
}: DocumentWriterOptions) {
  async function finishWrite(version: number): Promise<true> {
    setSavedVersion(version)
    try {
      await onWriteSuccess?.(version)
    } catch (error) {
      console.warn('[Recovery] Cleanup after document write failed:', error)
    }
    return true
  }

  return async function writeFile(data: Uint8Array, version: number): Promise<boolean> {
    setLastWriteTime(Date.now())
    try {
      const storage = getStorageBinding()
      if (storage) {
        await persistStorageCanvasLocally({
          ...storageLocationOf(storage),
          canvasId: storage.documentId,
          name: state.documentName || 'Untitled',
          figBytes: data
        })
        return await finishWrite(version)
      }

      const filePath = getFilePath()
      const fileHandle = getFileHandle()
      if (filePath && isTauri()) {
        // The system picker answers with a document URI, which no filesystem call can open.
        if (isAndroid() && filePath.startsWith('content://')) {
          await writeToAndroidDocument(filePath, data)
          return await finishWrite(version)
        }
        await tauriWrite(filePath, data)
        return await finishWrite(version)
      }
      if (fileHandle) {
        const writable = await fileHandle.createWritable()
        await writable.write(new Uint8Array(data))
        await writable.close()
        return await finishWrite(version)
      }
      return false
    } catch (error) {
      recordDocumentFailure({
        operation: 'save',
        format: 'fig',
        ...describeDiagnosticError(error),
        retryable: describeDiagnosticError(error).retryable
      })
      throw error
    }
  }
}
