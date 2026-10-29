import type {
  DocumentVersion,
  DocumentVersions,
  SaveDocumentVersionInput,
  UpdateDocumentVersionInput
} from '@open-pencil/cloud/contract'

import type { EditorStore } from '@/app/editor/session'
import { openStorageDocumentInNewTab } from '@/app/tabs'

import { restartCloudRoom, uploadCloudDocument } from '../rooms/live'
import { cloudShareTarget } from '../sharing/document'
import { closeVersionHistory, versionHistoryOf } from './history'

function targetOf(store: EditorStore) {
  const document = versionHistoryOf(store)?.store ?? store
  const binding = document.getStorageBinding()
  const target = binding && cloudShareTarget(binding)
  if (!binding || !target) throw new Error('This document is not on a Cloud server')
  return { document, binding, target }
}

/** Who is signed in to the document's server, for the history's "Only yours". */
export function versionHistoryAccountId(store: EditorStore): string | null {
  const binding = (versionHistoryOf(store)?.store ?? store).getStorageBinding()
  return (binding && cloudShareTarget(binding)?.accountId) ?? null
}

/** A page of the document's history, newest first, older than `before` when given. */
export async function listVersions(store: EditorStore, before?: string): Promise<DocumentVersions> {
  const { target } = targetOf(store)
  return target.client.listDocumentVersions(target.documentId, { before })
}

/**
 * Names the document as it is now. Edits not on the server yet are uploaded first, by the room's
 * saver when another tab saves for the room, so the version holds what is on screen.
 */
export async function saveVersion(
  store: EditorStore,
  input: SaveDocumentVersionInput
): Promise<DocumentVersion> {
  const { document, target } = targetOf(store)
  if (!(await uploadCloudDocument(document))) {
    throw new Error('The document could not be saved before naming the version')
  }
  return target.client.saveDocumentVersion(target.documentId, input)
}

/** Renames a version, or with a null name deletes its info and leaves an autosave. */
export async function editVersion(
  store: EditorStore,
  version: DocumentVersion,
  input: UpdateDocumentVersionInput
): Promise<DocumentVersion> {
  const { target } = targetOf(store)
  return target.client.updateDocumentVersion(target.documentId, version.id, input)
}

/**
 * Makes a version the document again, as Figma's Restore this version: the history closes and
 * the tab, with everyone else in the room, moves on to the restored document.
 */
export async function restoreVersion(store: EditorStore, version: DocumentVersion): Promise<void> {
  const { document, target } = targetOf(store)
  await target.client.restoreDocumentVersion(target.documentId, version.id)
  closeVersionHistory(document)
  await restartCloudRoom(document)
}

/** Copies a version into a new document beside this one and opens it. */
export async function duplicateVersion(
  store: EditorStore,
  version: DocumentVersion,
  name: string
): Promise<void> {
  const { binding, target } = targetOf(store)
  const copy = await target.client.duplicateDocumentVersion(target.documentId, version.id, {
    name
  })
  await openStorageDocumentInNewTab(
    { id: copy.id, name: copy.name, updatedAt: copy.updatedAt, revision: copy.currentRevisionId },
    binding
  )
}
