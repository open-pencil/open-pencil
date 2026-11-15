import { lstat, remove, rename, writeFile as tauriWrite } from '@tauri-apps/plugin-fs'

import { randomHex } from '@open-pencil/scene-graph/random'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { storageLocationOf } from '@/app/integrations/storage/location'
import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = { documentName: string }

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  /** A desktop save replaced the file, which a watcher on the old one may no longer see. */
  onFileReplaced?: () => void
  onWriteSuccess?: (version: number) => void | Promise<void>
}

/** Where a save goes, taken when it is asked for, so a later retarget does not redirect it. */
interface WriteTarget {
  storage: StorageDocumentBinding | null
  filePath: string | null
  fileHandle: FileSystemFileHandle | null
}

/** How many bytes one raw `write_file` call carries; smaller archive chunks are gathered. */
const TAURI_WRITE_BYTES = 8 * 1024 * 1024

/**
 * Writes `stream` to `path` as raw request bodies of up to `TAURI_WRITE_BYTES`, the first replacing
 * what is there: `FileHandle.write` would send each chunk as a JSON number array.
 */
async function writeTauriFile(path: string, stream: ReadableStream<Uint8Array>): Promise<void> {
  const pending = new Uint8Array(TAURI_WRITE_BYTES)
  let used = 0
  let append = false
  const flush = async () => {
    await tauriWrite(path, pending.subarray(0, used), { append })
    append = true
    used = 0
  }
  await stream.pipeTo(
    new WritableStream<Uint8Array>({
      async write(chunk) {
        for (let offset = 0; offset < chunk.byteLength;) {
          const take = Math.min(TAURI_WRITE_BYTES - used, chunk.byteLength - offset)
          pending.set(chunk.subarray(offset, offset + take), used)
          used += take
          offset += take
          if (used === TAURI_WRITE_BYTES) await flush()
        }
      },
      close: () => (used > 0 || !append ? flush() : undefined)
    })
  )
}

/**
 * Writes `stream` beside `path` and moves it over `path` once it is complete, so a save that fails
 * partway leaves the file as it was. Each save has its own copy, without a leading dot, which the
 * fs scope would refuse (`desktop/AGENTS.md`). A symbolic link is written through instead, so it
 * keeps pointing at its target, as a save always did.
 * @returns whether the file was replaced rather than written in place.
 */
async function saveTauriFile(path: string, stream: ReadableStream<Uint8Array>): Promise<boolean> {
  if ((await lstat(path).catch(() => null))?.isSymlink) {
    await writeTauriFile(path, stream)
    return false
  }
  const partial = `${path}.${randomHex(8)}.saving`
  try {
    await writeTauriFile(partial, stream)
    await rename(partial, path)
    return true
  } catch (error) {
    await remove(partial).catch(() => undefined)
    throw error
  }
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  getStorageBinding,
  setSavedVersion,
  setLastWriteTime,
  onFileReplaced,
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

  async function writeNow(
    stream: ReadableStream<Uint8Array>,
    version: number,
    { storage, filePath, fileHandle }: WriteTarget
  ): Promise<boolean> {
    try {
      if (storage) {
        await persistStorageCanvasLocally({
          ...storageLocationOf(storage),
          canvasId: storage.documentId,
          name: state.documentName || 'Untitled',
          figBytes: await new Response(stream).blob()
        })
        return await finishWrite(version)
      }
      if (filePath && isTauri()) {
        const replaced = await saveTauriFile(filePath, stream)
        const finished = await finishWrite(version)
        if (replaced) onFileReplaced?.()
        return finished
      }
      if (fileHandle) {
        // The browser writes into a copy and swaps it in on close; a failure discards the copy.
        await stream.pipeTo(await fileHandle.createWritable())
        return await finishWrite(version)
      }
      await stream.cancel()
      return false
    } catch (error) {
      // A target that failed before reading the stream leaves its producer, such as the archive
      // worker's port, waiting; a stream already read or cancelled ignores this.
      await stream.cancel(error).catch(() => undefined)
      recordDocumentFailure({
        operation: 'save',
        format: 'fig',
        ...describeDiagnosticError(error),
        retryable: describeDiagnosticError(error).retryable
      })
      throw error
    }
  }

  /** A save waits for the one before it, so two never write the same file at once. */
  let queue: Promise<unknown> = Promise.resolve()

  /**
   * Writes the `.fig` as `stream` produces it: the archive is never held whole, and a failure
   * partway leaves the previous file in place. A write the document has no target for cancels it.
   */
  return function writeFile(stream: ReadableStream<Uint8Array>, version: number): Promise<boolean> {
    const target: WriteTarget = {
      storage: getStorageBinding(),
      filePath: getFilePath(),
      fileHandle: getFileHandle()
    }
    const run = queue.catch(() => undefined).then(() => writeNow(stream, version, target))
    queue = run
    return run
  }
}
