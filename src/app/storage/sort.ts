import type { StorageDocument } from '@/app/integrations/storage'

export type StorageSortMode = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc'

export function sortStorageDocuments(
  documents: readonly StorageDocument[],
  mode: StorageSortMode
): StorageDocument[] {
  const direction = mode === 'name-desc' || mode === 'date-asc' ? -1 : 1
  return [...documents].sort((first, second) => {
    if (mode.startsWith('name')) {
      return (
        first.name.localeCompare(second.name, undefined, {
          numeric: true,
          sensitivity: 'base'
        }) * direction
      )
    }
    return second.updatedAt.localeCompare(first.updatedAt) * direction
  })
}
