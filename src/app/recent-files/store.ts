import { useLocalStorage } from '@vueuse/core'
import { basename } from 'pathe'
import { computed } from 'vue'

import { DOCUMENT_EXTENSIONS } from '@open-pencil/core/io'
import type { DocumentKind } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  DEFAULT_STORAGE_PROFILE,
  storageLocationOf,
  storageProfileId,
  type StorageDocumentBinding,
  type StorageProviderID
} from '@/app/integrations/storage'

import { recentFilesLimit } from './preferences'
import { clearRecentFileThumbnails } from './thumbnails'

const RECENT_DOCUMENTS_STORAGE_KEY = 'open-pencil:recent-documents'

/** The page and view a document was left at, which it opens on again, as in Figma. */
export interface RecentDocumentView {
  pageId: string
  /** The world point at the centre of the canvas. */
  center: Vector
  zoom: number
}

export interface RecentLocalDocument {
  id: string
  kind: 'local'
  path: string
  name: string
  updatedAt: string
  /** A design or a board; entries recorded before this was kept have none. */
  documentKind?: DocumentKind
  view?: RecentDocumentView
}

export interface RecentStorageDocument {
  id: string
  kind: 'storage'
  providerId: StorageProviderID
  profileId?: string
  containerId?: string
  documentId: string
  name: string
  updatedAt: string
  /** A design or a board; entries recorded before this was kept have none. */
  documentKind?: DocumentKind
  view?: RecentDocumentView
}

export type RecentDocument = RecentLocalDocument | RecentStorageDocument

export const recentDocuments = useLocalStorage<RecentDocument[]>(RECENT_DOCUMENTS_STORAGE_KEY, [])

function fileName(path: string): string {
  return basename(path) || path
}

function localDocumentId(path: string): string {
  return `local:${path}`
}

function storageDocumentId(binding: StorageDocumentBinding): string {
  const profileId = storageProfileId(binding)
  // Documents of single-account providers keep the IDs they had before profiles existed.
  return profileId === DEFAULT_STORAGE_PROFILE
    ? `storage:${binding.providerId}:${binding.documentId}`
    : `storage:${binding.providerId}:${profileId}:${binding.documentId}`
}

function normalizedRecentDocuments(): RecentDocument[] {
  return recentDocuments.value.slice(0, recentFilesLimit.value)
}

export const recentFiles = computed<RecentDocument[]>(normalizedRecentDocuments)

export const recentLocalFilePaths = computed<string[]>(() =>
  normalizedRecentDocuments().flatMap((document) =>
    document.kind === 'local' ? [document.path] : []
  )
)

function remember(document: RecentDocument): void {
  const others = normalizedRecentDocuments().filter((recent) => recent.id !== document.id)
  const previous = recentDocuments.value.find((recent) => recent.id === document.id)
  // Opening or saving a document again keeps the view it was left at.
  const view = document.view ?? previous?.view
  recentDocuments.value = [view ? { ...document, view } : document, ...others].slice(
    0,
    recentFilesLimit.value
  )
}

/**
 * The recent-files id of an open document: a stored one by its binding, a file by its path; none
 * for a document that is neither, which recent files do not list.
 */
export function recentDocumentIdOf(
  path: string | null,
  binding: StorageDocumentBinding | null
): string | null {
  if (binding) return storageDocumentId(binding)
  return path ? localDocumentId(path) : null
}

/** Keeps the view a listed document was left at, without moving it up the list. */
export function rememberRecentDocumentView(id: string, view: RecentDocumentView): void {
  if (!recentDocuments.value.some((document) => document.id === id)) return
  recentDocuments.value = recentDocuments.value.map((document) =>
    document.id === id ? { ...document, view } : document
  )
}

/** The view a listed document was left at, if one was kept. */
export function recentDocumentView(id: string): RecentDocumentView | null {
  return recentDocuments.value.find((document) => document.id === id)?.view ?? null
}

/** What a file on this device is by its name: a FigJam `.jam` is a board, anything else a design. */
function localDocumentKind(path: string): DocumentKind {
  return path.toLowerCase().endsWith(`.${DOCUMENT_EXTENSIONS.board}`) ? 'board' : 'design'
}

/**
 * A recent file's kind: as recorded, or for one recorded before kinds were, by its name on this
 * device and as a design elsewhere, as storage lists files whose kind they do not know.
 */
export function recentDocumentKind(document: RecentDocument): DocumentKind {
  if (document.documentKind) return document.documentKind
  return document.kind === 'local' ? localDocumentKind(document.path) : 'design'
}

/** Remembers a file opened or saved on this device, as the kind the opened document is. */
export function rememberRecentFile(path: string, documentKind: DocumentKind): void {
  remember({
    id: localDocumentId(path),
    kind: 'local',
    path,
    name: fileName(path),
    updatedAt: new Date().toISOString(),
    documentKind
  })
}

export function rememberRecentStorageDocument(
  binding: StorageDocumentBinding,
  name: string,
  documentKind: DocumentKind
): void {
  remember({
    id: storageDocumentId(binding),
    kind: 'storage',
    ...storageLocationOf(binding),
    documentId: binding.documentId,
    name,
    updatedAt: new Date().toISOString(),
    documentKind
  })
}

export function forgetRecentDocument(id: string): void {
  recentDocuments.value = normalizedRecentDocuments().filter((document) => document.id !== id)
}

export function forgetRecentFile(path: string): void {
  forgetRecentDocument(localDocumentId(path))
}

export function forgetRecentStorageDocument(binding: StorageDocumentBinding): void {
  forgetRecentDocument(storageDocumentId(binding))
}

export async function clearRecentFiles(): Promise<void> {
  recentDocuments.value = []
  await clearRecentFileThumbnails()
}

export function recentLocalFileAt(index: number): string | null {
  return recentLocalFilePaths.value[index] ?? null
}
