import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { StorageProviderID } from '@/app/integrations/storage'

import { clearRecentFileThumbnails } from './thumbnails'

const MAX_RECENT_DOCUMENTS = 10
const RECENT_DOCUMENTS_STORAGE_KEY = 'open-pencil:recent-documents'

export interface RecentLocalDocument {
  id: string
  kind: 'local'
  path: string
  name: string
  updatedAt: string
}

export interface RecentStorageDocument {
  id: string
  kind: 'storage'
  providerId: StorageProviderID
  documentId: string
  name: string
  updatedAt: string
}

export type RecentDocument = RecentLocalDocument | RecentStorageDocument

export const recentDocuments = useLocalStorage<RecentDocument[]>(RECENT_DOCUMENTS_STORAGE_KEY, [])

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function localDocumentId(path: string): string {
  return `local:${path}`
}

function storageDocumentId(providerId: StorageProviderID, documentId: string): string {
  return `storage:${providerId}:${documentId}`
}

function normalizedRecentDocuments(): RecentDocument[] {
  return recentDocuments.value.slice(0, MAX_RECENT_DOCUMENTS)
}

export const recentFiles = computed<RecentDocument[]>(normalizedRecentDocuments)

export const recentLocalFilePaths = computed<string[]>(() =>
  normalizedRecentDocuments().flatMap((document) =>
    document.kind === 'local' ? [document.path] : []
  )
)

function remember(document: RecentDocument): void {
  recentDocuments.value = [
    document,
    ...normalizedRecentDocuments().filter((recent) => recent.id !== document.id)
  ].slice(0, MAX_RECENT_DOCUMENTS)
}

export function rememberRecentFile(path: string): void {
  remember({
    id: localDocumentId(path),
    kind: 'local',
    path,
    name: fileName(path),
    updatedAt: new Date().toISOString()
  })
}

export function rememberRecentStorageDocument(
  providerId: StorageProviderID,
  documentId: string,
  name: string
): void {
  remember({
    id: storageDocumentId(providerId, documentId),
    kind: 'storage',
    providerId,
    documentId,
    name,
    updatedAt: new Date().toISOString()
  })
}

export function forgetRecentDocument(id: string): void {
  recentDocuments.value = normalizedRecentDocuments().filter((document) => document.id !== id)
}

export function forgetRecentFile(path: string): void {
  forgetRecentDocument(localDocumentId(path))
}

export async function clearRecentFiles(): Promise<void> {
  recentDocuments.value = []
  await clearRecentFileThumbnails()
}

export function recentLocalFileAt(index: number): string | null {
  return recentLocalFilePaths.value[index] ?? null
}
