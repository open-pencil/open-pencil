import { computed, ref, watch, type Ref } from 'vue'

import type { EditorStore } from '@/app/editor/session'
import { createActiveStorageAdapter, storagePreferencesComplete } from '@/app/integrations/storage'
import { activeStorageProviderID } from '@/app/integrations/storage/preferences'
import {
  readLibraryCatalogSource,
  readLibraryPriority,
  StorageLibraryCatalog,
  type LibraryService
} from '@/app/libraries'
import type { LibraryAssetUpdateGroup } from '@/app/libraries/update-groups'
import { scopeLibraryUpdateGroups } from '@/app/libraries/update-groups'
import { toast } from '@/app/shell/ui'

export function useLibraryManager(
  open: Ref<boolean>,
  editor: EditorStore,
  service: LibraryService
) {
  const section = ref<'browse' | 'updates'>('browse')
  const loading = ref(false)
  const showAllPages = ref(false)
  const applying = ref<string | null>(null)
  const updateGroups = ref<LibraryAssetUpdateGroup[]>([])
  let requestId = 0
  const visibleUpdateGroups = computed(() =>
    scopeLibraryUpdateGroups(editor, updateGroups.value, showAllPages.value)
  )

  async function refresh() {
    const request = ++requestId
    loading.value = true
    try {
      await service.refresh(editor)
      const groups = await service.getUpdateGroups(editor)
      if (request === requestId) updateGroups.value = groups
    } catch (cause) {
      if (request === requestId) {
        toast.error(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (request === requestId) loading.value = false
    }
  }

  async function setSource(source: 'local' | 'storage') {
    if (source === 'local') service.useLocalCatalog()
    else {
      const providerId = activeStorageProviderID.value
      if (!storagePreferencesComplete(providerId)) throw new Error('Storage is not configured')
      const objects = createActiveStorageAdapter(providerId).libraryObjects
      if (!objects) throw new Error('Storage libraries are unavailable')
      service.useStorageCatalog(new StorageLibraryCatalog(objects))
    }
    await refresh()
  }

  async function toggleLibrary(libraryId: string) {
    if (editor.graph.enabledLibraries.get(libraryId)?.enabled)
      await service.disable(editor, libraryId)
    else await service.enable(editor, libraryId)
    await refresh()
  }

  function preferLibrary(libraryId: string) {
    const priority = Math.max(
      0,
      ...service.summaries.value.map((item) => readLibraryPriority(item.libraryId))
    )
    service.setPriority(libraryId, priority + 1)
  }

  async function updateAsset(group: LibraryAssetUpdateGroup) {
    applying.value = `${group.libraryId}:${group.assetKey}`
    try {
      await service.applyUpdateGroups(editor, [group], `Update ${group.name}`)
      await refresh()
    } finally {
      applying.value = null
    }
  }

  async function updateAll() {
    applying.value = 'all'
    try {
      await service.applyUpdateGroups(
        editor,
        visibleUpdateGroups.value,
        'Update all library assets'
      )
      await refresh()
    } finally {
      applying.value = null
    }
  }

  watch(
    () => [open.value, service.updates.value, editor.state.currentPageId] as const,
    ([isOpen]) => {
      if (isOpen) void refresh()
    },
    { immediate: true }
  )

  const source = readLibraryCatalogSource()
  if (source === 'storage') void setSource('storage')

  return {
    section,
    loading,
    showAllPages,
    applying,
    visibleUpdateGroups,
    refresh,
    setSource,
    toggleLibrary,
    preferLibrary,
    updateAsset,
    updateAll
  }
}
