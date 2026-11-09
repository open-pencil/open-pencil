import { remove, rename, writeFile as tauriWriteFile } from '@tauri-apps/plugin-fs'

import type { FigArchiveSink } from '@open-pencil/core/io/formats/fig'

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

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const chunk of chunks) length += chunk.byteLength
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Bytes the Tauri writer hands to one raw IPC write; files are written in this many bytes. */
const TAURI_CHUNK_BYTES = 8 * 1024 * 1024

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

  async function writeFile(
    stream: DocumentStream,
    version: number,
    onProgress?: (written: number, total: number) => void
  ): Promise<boolean> {
    setLastWriteTime(Date.now())
    try {
      const storage = getStorageBinding()
      if (storage) {
        const chunks: Uint8Array[] = []
        await stream((chunk) => {
          chunks.push(chunk)
        }, onProgress)
        await persistStorageCanvasLocally({
          ...storageLocationOf(storage),
          canvasId: storage.documentId,
          name: state.documentName || 'Untitled',
          figBytes: concatenate(chunks)
        })
        return await finishWrite(version)
      }

      const filePath = getFilePath()
      const fileHandle = getFileHandle()
      if (filePath && isTauri()) {
        // Replace the file only once every byte is written, so a failed export leaves the
        // previous save intact. The temporary name has no leading dot: the fs scope keeps
        // hidden files out of `**`.
        const temporary = `${filePath}.saving`
        try {
          // `write_file` sends its bytes as a raw IPC body. `FileHandle.write` sends the same
          // bytes as a JSON number array, which made a large save take minutes.
          await tauriWriteFile(temporary, new Uint8Array(0))
          const pending = new Uint8Array(TAURI_CHUNK_BYTES)
          let used = 0
          const flush = async () => {
            if (used === 0) return
            await tauriWriteFile(temporary, pending.subarray(0, used), {
              append: true,
              create: true
            })
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

  return writeFile
}
