import { open, remove, rename } from '@tauri-apps/plugin-fs'

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

/** Writes every byte of a chunk, since a platform write may accept only part of it. */
async function writeAll(write: (bytes: Uint8Array) => Promise<number>, chunk: Uint8Array) {
  let offset = 0
  while (offset < chunk.byteLength) {
    const written = await write(chunk.subarray(offset))
    if (written <= 0) throw new Error('The save wrote no bytes')
    offset += written
  }
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
          const file = await open(temporary, { write: true, create: true, truncate: true })
          try {
            await stream((chunk) => writeAll((bytes) => file.write(bytes), chunk), onProgress)
          } finally {
            await file.close()
          }
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
