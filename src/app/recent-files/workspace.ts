import { watch } from 'vue'

import { useDocumentWorkspace } from '@open-pencil/vue/document/workspace'

import {
  createStorageAdapter,
  sameStorageLocation,
  storageLocationOf,
  type StorageDocument
} from '@/app/integrations/storage'
import { openFileFromPath } from '@/app/shell/menu/use'
import { activeStorageLocation, createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'

import { isRecentFileOpenCancellation } from './open-errors'
import { forgetRecentDocument, recentFiles, type RecentDocument } from './store'
import { loadRecentFileThumbnail } from './thumbnails'

/** The recent files with their previews, as Home and a New file tab list them. */
export function useRecentFilesWorkspace() {
  const workspace = useDocumentWorkspace<RecentDocument>({
    source: {
      async refresh() {
        return recentFiles.value
      },
      loadPreview(documentId) {
        const document = recentFiles.value.find((candidate) => candidate.id === documentId)
        if (!document) return Promise.resolve(null)
        if (document.kind === 'local') return loadRecentFileThumbnail(document.path)
        return createStorageWorkspaceSource(
          () => undefined,
          () => storageLocationOf(document)
        ).loadPreview(document.documentId)
      }
    },
    refreshOnFocus: false,
    refreshOnReconnect: false,
    previewConcurrency: 2
  })
  watch(recentFiles, () => void workspace.invalidate())
  return workspace
}

export type RecentFilesWorkspace = ReturnType<typeof useRecentFilesWorkspace>

/** The recent files whose name, path, or stored id holds `query`, already lowercased in `locale`. */
export function matchingRecentFiles(
  documents: readonly RecentDocument[],
  query: string,
  locale: string
): readonly RecentDocument[] {
  if (!query) return documents
  return documents.filter((document) =>
    `${document.name}\n${document.kind === 'local' ? document.path : document.documentId}`
      .toLocaleLowerCase(locale)
      .includes(query)
  )
}

/**
 * Opens a recent file. A stored one opens with the revision its storage lists, so a stale copy on
 * this device is not taken for current: `listed` is the active storage's listing when the caller
 * has it, and other places are listed here; offline, the copy opens as it is. A failed open is
 * forgotten, except when closing its tab cancels the open.
 */
type OpenRecentDocumentDependencies = {
  openLocalFile?: typeof openFileFromPath
  forgetRecentDocument?: typeof forgetRecentDocument
}

export async function openRecentDocument(
  document: RecentDocument,
  listed?: readonly StorageDocument[],
  dependencies: OpenRecentDocumentDependencies = {}
): Promise<void> {
  const openLocalFile = dependencies.openLocalFile ?? openFileFromPath
  const forget = dependencies.forgetRecentDocument ?? forgetRecentDocument
  try {
    if (document.kind === 'local') {
      await openLocalFile(document.path)
      return
    }
    const location = storageLocationOf(document)
    const listing =
      listed && sameStorageLocation(location, activeStorageLocation())
        ? listed
        : await createStorageAdapter(location)
            .listDocuments()
            .catch(() => [])
    const found = listing.find((candidate) => candidate.id === document.documentId)
    await openStorageDocumentInNewTab(
      found ?? { id: document.documentId, name: document.name, updatedAt: document.updatedAt },
      location
    )
  } catch (error) {
    if (!isRecentFileOpenCancellation(error)) forget(document.id)
    throw error
  }
}
