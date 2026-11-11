import { downloadZip } from 'client-zip'
import { limitAsync } from 'es-toolkit'

import { createCloudAPIClient } from '@open-pencil/cloud/client'
import type { CloudAccountDeletion } from '@open-pencil/cloud/contract'
import type { DocumentKind } from '@open-pencil/scene-graph'

import { bundleExportFiles, createZipEntryNamer } from '@/app/document/export/zip'
import { downloadBlob } from '@/app/document/io/browser'
import {
  isFileWriteRefused,
  pickBrowserSaveFile,
  supportsFileSystemAccess
} from '@/app/document/io/capability'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'

type ArchiveDocument = CloudAccountDeletion['documents'][number]

/**
 * How many documents download at once when the zip is built in memory; each also fetches its
 * images six at a time.
 */
const DOCUMENT_CONCURRENCY = 3

/**
 * The extension each kind saves under, as the editor's own Save does (Core's
 * `DOCUMENT_EXTENSIONS`, which the portal does not load).
 */
const EXTENSIONS = { design: 'fig', board: 'jam' } as const satisfies Record<DocumentKind, string>

export type AccountArchiveProgress = { done: number; total: number }

/** How far Download all got: files saved so far of all of them, and the names it couldn't get. */
export type PortalAccountArchive = {
  done: number
  total: number
  /** Set once it finished: how many it saved. */
  saved: number | null
  failed: string[]
}

export type AccountArchiveResult = {
  saved: number
  /** The documents that could not be downloaded, which the archive leaves out. */
  failed: ArchiveDocument[]
}

/** Where a streamed archive is written: the file the person picked. */
export type AccountArchiveFile = { createWritable(): Promise<WritableStream<Uint8Array>> }

/** A document as the archive saves it; it rejects when the document could not be downloaded. */
type ArchiveFetch = (document: ArchiveDocument) => Promise<{ bytes: Uint8Array; fileName: string }>

export type AccountArchiveOptions = {
  /** The server's API address, from its discovery document. */
  apiURL: string
  archiveName: string
  signal?: AbortSignal
  onProgress?: (progress: AccountArchiveProgress) => void
  fetch?: typeof globalThis.fetch
  /** Saves a zip built in memory, where the browser cannot write to a file as it goes. */
  save?: (bytes: Uint8Array, name: string) => void
  /**
   * Asks where to write the zip as it is made, or answers null where the browser cannot, which
   * builds it in memory instead. Rejects with `AbortError` when the person cancels.
   */
  pickFile?: (name: string) => Promise<AccountArchiveFile | null>
}

/** Chromium's save picker for a zip, or null in browsers without File System Access. */
function pickZipFile(name: string): Promise<FileSystemFileHandle | null> {
  if (!supportsFileSystemAccess()) return Promise.resolve(null)
  return pickBrowserSaveFile({
    suggestedName: name,
    types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }]
  })
}

/**
 * Downloads `documents` as the editor opens them, images included, and saves them as one zip,
 * named by each document with duplicates numbered. A document that fails to download is left
 * out and reported. Where the browser can write to a file as it goes, the person picks one first
 * and documents go into it one at a time, so an archive of any size holds about one document in
 * memory; elsewhere the zip is built in memory and saved when at least one document arrived.
 * Resolves to null when the person cancels the picker.
 */
export async function saveAccountArchive(
  documents: readonly ArchiveDocument[],
  options: AccountArchiveOptions
): Promise<AccountArchiveResult | null> {
  // The picker comes first, while the click that asked for it still counts as the person's.
  let file: AccountArchiveFile | null
  try {
    file = await (options.pickFile ?? pickZipFile)(options.archiveName)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null
    throw error
  }
  const objectFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const client = createCloudAPIClient(options.apiURL, {
    fetch: options.fetch,
    signal: options.signal
  })
  const fetchDocument: ArchiveFetch = async (document) => {
    const stored = await client.getDocument(document.id)
    const bytes = await downloadCloudDocument(stored, objectFetch, { signal: options.signal })
    return { bytes, fileName: `${document.name}.${EXTENSIONS[stored.document.kind]}` }
  }
  if (file) {
    let writable: WritableStream<Uint8Array> | null = null
    try {
      writable = await file.createWritable()
    } catch (error) {
      // Some embedded browsers hand out a file but refuse to write it: build the zip in memory.
      if (!isFileWriteRefused(error)) throw error
    }
    if (writable) {
      try {
        return await streamArchive(documents, fetchDocument, writable, options)
      } catch (error) {
        // Some refuse only once written to. The zip is built in memory instead, fetching the
        // documents again, which costs little since a refusal comes with the first write.
        if (options.signal?.aborted || !isFileWriteRefused(error)) throw error
      }
    }
  }
  return bufferArchive(documents, fetchDocument, options)
}

/** Writes the zip into `writable` one document at a time, so memory holds about one. */
async function streamArchive(
  documents: readonly ArchiveDocument[],
  fetchDocument: ArchiveFetch,
  writable: WritableStream<Uint8Array>,
  options: AccountArchiveOptions
): Promise<AccountArchiveResult> {
  const name = createZipEntryNamer()
  const failed: ArchiveDocument[] = []
  let done = 0
  options.onProgress?.({ done, total: documents.length })
  async function* entries() {
    for (const document of documents) {
      let entry: { name: string; input: Uint8Array } | null = null
      try {
        const { bytes, fileName } = await fetchDocument(document)
        entry = { name: name(fileName), input: bytes }
      } catch (error) {
        if (options.signal?.aborted) throw error
        failed.push(document)
      } finally {
        done++
        options.onProgress?.({ done, total: documents.length })
      }
      if (entry) yield entry
    }
    // Ending the source with an error aborts the file instead of closing it on an empty zip.
    if (failed.length === documents.length) throw new NothingSavedError()
  }
  try {
    await downloadZip(entries()).body?.pipeTo(writable, { signal: options.signal })
  } catch (error) {
    if (!(error instanceof NothingSavedError)) throw error
  }
  return { saved: documents.length - failed.length, failed }
}

/** Every document failed, so the picked file is left unwritten. */
class NothingSavedError extends Error {
  override readonly name = 'NothingSavedError'
}

/** Builds the zip in memory, a few documents at a time, and saves it once all arrived. */
async function bufferArchive(
  documents: readonly ArchiveDocument[],
  fetchDocument: ArchiveFetch,
  options: AccountArchiveOptions
): Promise<AccountArchiveResult> {
  let done = 0
  options.onProgress?.({ done, total: documents.length })
  const download = limitAsync(async (document: ArchiveDocument) => {
    try {
      return { document, file: await fetchDocument(document) }
    } catch (error) {
      if (options.signal?.aborted) throw error
      return { document, file: null }
    } finally {
      done++
      options.onProgress?.({ done, total: documents.length })
    }
  }, DOCUMENT_CONCURRENCY)
  const results = await Promise.all(documents.map(download))
  const files = results.flatMap((result) => (result.file ? [result.file] : []))
  if (files.length > 0) {
    const save = options.save ?? ((bytes, name) => downloadBlob(bytes, name, 'application/zip'))
    save(bundleExportFiles(files), options.archiveName)
  }
  return {
    saved: files.length,
    failed: results.flatMap((result) => (result.file ? [] : [result.document]))
  }
}
