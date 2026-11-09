import { lstat, remove, rename, writeFile as tauriWriteFile } from '@tauri-apps/plugin-fs'

import type { FigArchiveSink } from '@open-pencil/core/io/formats/fig'
import { concatenateBytes } from '@open-pencil/core/io/formats/fig'
import { randomHex } from '@open-pencil/scene-graph/random'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { bufferSource } from '@/app/document/io/bytes'
import { storageLocationOf } from '@/app/integrations/storage/location'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = { documentName: string }

/** Writes a document into a sink, reporting the bytes it has produced so far. */
export type DocumentStream = (
  sink: FigArchiveSink,
  onProgress?: (written: number, total: number) => void
) => Promise<void>

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  onWriteSuccess?: (version: number) => void | Promise<void>
}

/** Bytes the Tauri writer hands to one raw IPC write; files are written in this many bytes. */
const TAURI_CHUNK_BYTES = 8 * 1024 * 1024

/** Writes a stream into a desktop file as bounded raw request bodies. */
async function writeTauriPath(
  path: string,
  stream: DocumentStream,
  onProgress?: (written: number, total: number) => void
): Promise<void> {
  // `write_file` sends its bytes as a raw IPC body. `FileHandle.write` sends the same bytes as
  // a JSON number array, which made a large save take minutes.
  await tauriWriteFile(path, new Uint8Array(0))
  const pending = new Uint8Array(TAURI_CHUNK_BYTES)
  let used = 0
  const flush = async () => {
    if (used === 0) return
    await tauriWriteFile(path, pending.subarray(0, used), { append: true, create: true })
    used = 0
  }
  await stream(async (chunk) => {
    let offset = 0
    while (offset < chunk.byteLength) {
      const take = Math.min(TAURI_CHUNK_BYTES - used, chunk.byteLength - offset)
      pending.set(chunk.subarray(offset, offset + take), used)
      used += take
      offset += take
      if (used === TAURI_CHUNK_BYTES) await flush()
    }
  }, onProgress)
  await flush()
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
    setLastWriteTime(Date.now())
    setSavedVersion(version)
    try {
      await onWriteSuccess?.(version)
    } catch (error) {
      console.warn('[Recovery] Cleanup after document write failed:', error)
    }
    // The watcher ignores a change this recent; reset it after cleanup so a slow recovery
    // snapshot cannot let the completed write look like an external edit.
    setLastWriteTime(Date.now())
    return true
  }

  interface WriteTarget {
    storage: StorageDocumentBinding | null
    filePath: string | null
    fileHandle: FileSystemFileHandle | null
  }

  async function writeNow(
    stream: DocumentStream,
    version: number,
    target: WriteTarget,
    onProgress?: (written: number, total: number) => void
  ): Promise<boolean> {
    try {
      const { storage } = target
      if (storage) {
        const chunks: Uint8Array[] = []
        await stream((chunk) => {
          chunks.push(chunk)
        }, onProgress)
        await persistStorageCanvasLocally({
          ...storageLocationOf(storage),
          canvasId: storage.documentId,
          name: state.documentName || 'Untitled',
          figBytes: concatenateBytes(chunks)
        })
        return await finishWrite(version)
      }

      const filePath = target.filePath
      const fileHandle = target.fileHandle
      if (filePath && isTauri()) {
        // A link keeps pointing at its target: the previous writer followed it, and replacing
        // the link with a regular file would surprise the person who made it. Such a save is
        // direct, so a failed one leaves a partial target as it always did.
        const info = await lstat(filePath).catch(() => null)
        if (info?.isSymlink) {
          await writeTauriPath(filePath, stream, onProgress)
          return await finishWrite(version)
        }
        // Replace the file only once every byte is written, so a failed export leaves the
        // previous save intact. The temporary name has no leading dot: the fs scope keeps
        // hidden files out of `**`.
        const temporary = `${filePath}.${randomHex(8)}.saving`
        try {
          await writeTauriPath(temporary, stream, onProgress)
          await rename(temporary, filePath)
        } catch (error) {
          await remove(temporary).catch(() => undefined)
          throw error
        }
        return await finishWrite(version)
      }
      if (fileHandle) {
        const writable = await fileHandle.createWritable()
        try {
          await stream((chunk) => writable.write(bufferSource(chunk)), onProgress)
          await writable.close()
        } catch (error) {
          await writable.abort().catch(() => undefined)
          throw error
        }
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

  /** A save waits for the one before it, so two streams never share a temporary file. */
  let queue: Promise<unknown> = Promise.resolve()

  function writeFile(
    stream: DocumentStream,
    version: number,
    onProgress?: (written: number, total: number) => void
  ): Promise<boolean> {
    const target: WriteTarget = {
      storage: getStorageBinding(),
      filePath: getFilePath(),
      fileHandle: getFileHandle()
    }
    const run = queue
      .catch(() => undefined)
      .then(() => writeNow(stream, version, target, onProgress))
    queue = run
    return run
  }

  return writeFile
}
