import { useLocalStorage } from '@vueuse/core'

import type { LibraryCatalogSource } from './catalog/routed'

interface LibraryPreferences {
  catalogSource: LibraryCatalogSource
  priorities: Record<string, number>
}

const preferences = useLocalStorage<LibraryPreferences>('open-pencil:library-preferences', {
  catalogSource: 'local',
  priorities: {}
})

export function readLibraryCatalogSource(): LibraryCatalogSource {
  return preferences.value.catalogSource
}

export function writeLibraryCatalogSource(source: LibraryCatalogSource): void {
  preferences.value = { ...preferences.value, catalogSource: source }
}

export function readLibraryPriority(libraryId: string): number {
  const value = preferences.value.priorities[libraryId]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function writeLibraryPriority(libraryId: string, priority: number): void {
  if (!Number.isFinite(priority)) throw new TypeError('Library priority must be finite')
  preferences.value = {
    ...preferences.value,
    priorities: { ...preferences.value.priorities, [libraryId]: priority }
  }
}
