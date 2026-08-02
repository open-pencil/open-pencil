import type { StorageDocumentFormat } from '@/app/integrations/storage'
import { createStorageThumbnail } from '@/app/storage/thumbnail'

export type DroppedStorageFile = {
  name: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export type PreparedStorageImport = {
  name: string
  sourceFormat: StorageDocumentFormat
  bytes: Uint8Array
  thumbnailBytes: Uint8Array | null
}

export function isDeckStorageFile(fileName: string): boolean {
  return /\.deck$/i.test(fileName)
}

export function storageNameFromDeckFile(fileName: string): string {
  return fileName.replace(/\.deck$/i, '').trim() || 'Untitled'
}

export async function prepareDeckStorageImport(
  file: DroppedStorageFile
): Promise<PreparedStorageImport> {
  if (!isDeckStorageFile(file.name)) throw new Error('Only .deck files can be uploaded here.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const thumbnailBytes = await createStorageThumbnail(bytes, 'deck')
  return {
    name: storageNameFromDeckFile(file.name),
    sourceFormat: 'deck',
    bytes,
    thumbnailBytes
  }
}
