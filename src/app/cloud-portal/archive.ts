import { limitAsync } from 'es-toolkit'

import { createCloudAPIClient } from '@open-pencil/cloud/client'
import type { CloudAccountDeletion } from '@open-pencil/cloud/contract'
import type { DocumentKind } from '@open-pencil/scene-graph'

import { bundleExportFiles } from '@/app/document/export/zip'
import { downloadBlob } from '@/app/document/io/browser'
import { downloadCloudDocument } from '@/app/integrations/storage/cloud/download'

type ArchiveDocument = CloudAccountDeletion['documents'][number]

/** How many documents download at once; each also fetches its images six at a time. */
const DOCUMENT_CONCURRENCY = 3

/**
 * The extension each kind saves under, as the editor's own Save does (Core's
 * `DOCUMENT_EXTENSIONS`, which the portal does not load).
 */
const EXTENSIONS = { design: 'fig', board: 'jam' } as const satisfies Record<DocumentKind, string>

export type AccountArchiveProgress = { done: number; total: number }

export type AccountArchiveResult = {
  saved: number
  /** The documents that could not be downloaded, which the archive leaves out. */
  failed: ArchiveDocument[]
}

/**
 * Downloads `documents` as the editor opens them, images included, and saves them as one zip,
 * named by each document with duplicates numbered. A document that fails to download is left
 * out and reported; the zip is saved when at least one arrived.
 */
export async function saveAccountArchive(
  documents: readonly ArchiveDocument[],
  options: {
    /** The server's API address, from its discovery document. */
    apiURL: string
    archiveName: string
    signal?: AbortSignal
    onProgress?: (progress: AccountArchiveProgress) => void
    fetch?: typeof globalThis.fetch
    save?: (bytes: Uint8Array, name: string) => void
  }
): Promise<AccountArchiveResult> {
  const objectFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const client = createCloudAPIClient(options.apiURL, {
    fetch: options.fetch,
    signal: options.signal
  })
  let done = 0
  options.onProgress?.({ done, total: documents.length })
  const download = limitAsync(async (document: ArchiveDocument) => {
    try {
      const stored = await client.getDocument(document.id)
      const bytes = await downloadCloudDocument(stored, objectFetch, { signal: options.signal })
      return {
        document,
        file: { bytes, fileName: `${document.name}.${EXTENSIONS[stored.document.kind]}` }
      }
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
