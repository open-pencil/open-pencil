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

/**
 * The extension decides the format, because both are ZIP archives and sniffing
 * the container tells us nothing about which schema is inside.
 */
export function storageFormatForFile(fileName: string): StorageDocumentFormat | null {
  if (/\.deck$/i.test(fileName)) return 'deck'
  if (/\.fig$/i.test(fileName)) return 'fig'
  return null
}

export function isSupportedStorageFile(fileName: string): boolean {
  return storageFormatForFile(fileName) !== null
}

export function storageNameFromFile(fileName: string): string {
  return fileName.replace(/\.(deck|fig)$/i, '').trim() || 'Untitled'
}

export async function prepareStorageImport(
  file: DroppedStorageFile
): Promise<PreparedStorageImport> {
  const sourceFormat = storageFormatForFile(file.name)
  if (!sourceFormat) throw new Error('Only .fig and .deck files can be uploaded here.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const thumbnailBytes = await createStorageThumbnail(bytes, sourceFormat)
  return {
    name: storageNameFromFile(file.name),
    sourceFormat,
    bytes,
    thumbnailBytes
  }
}
