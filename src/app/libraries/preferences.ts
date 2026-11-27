import { useLocalStorage } from '@vueuse/core'

import type { LibraryCatalogSource } from './catalog/mirrored'

interface LibraryPreferences {
  catalogSource: LibraryCatalogSource
  priorities: Record<string, number>
}

export const libraryPreferences = useLocalStorage<LibraryPreferences>(
  'open-pencil:library-preferences',
  {
    catalogSource: 'local',
    priorities: {}
  }
)

export function readLibraryCatalogSource(): LibraryCatalogSource {
  return libraryPreferences.value.catalogSource
}

export function writeLibraryCatalogSource(source: LibraryCatalogSource): void {
  libraryPreferences.value = { ...libraryPreferences.value, catalogSource: source }
}

export function readLibraryPriority(libraryId: string): number {
  const value = libraryPreferences.value.priorities[libraryId]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function writeLibraryPriority(libraryId: string, priority: number): void {
  if (!Number.isFinite(priority)) throw new TypeError('Library priority must be finite')
  libraryPreferences.value = {
    ...libraryPreferences.value,
    priorities: { ...libraryPreferences.value.priorities, [libraryId]: priority }
  }
}
