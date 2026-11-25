import { watchDebounced } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'

import { maxOf } from '@open-pencil/std/arrays'
import { errorMessage } from '@open-pencil/std/errors'

import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import { storagePreferencesComplete } from '@/app/integrations/storage'
import { activeStorageProviderID } from '@/app/integrations/storage/preferences'
import { readLibraryPriority, type LibraryService } from '@/app/libraries'
import {
  libraryResolutionKey,
  librarySyncResolution,
  resumeLibrarySync
} from '@/app/libraries/sync'
import type { LibraryAssetUpdateGroup } from '@/app/libraries/updates/groups'
import { scopeLibraryUpdateGroups } from '@/app/libraries/updates/groups'
import { toast } from '@/app/shell/ui'

/** Resolution rows flip in bursts during a pull; one refresh per settle. */
const RESOLUTION_REFRESH_DEBOUNCE_MS = 300

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
  /**
   * Whether this opening's first read has finished. The dialog shows once it has, so it never
   * opens on the previous opening's updates, or on none, and then fills in.
   */
  const ready = ref(false)
  let requestId = 0
  watch(
    open,
    (isOpen) => {
      if (!isOpen) return
      ready.value = false
      // A read still running from before this opening must not mark it ready.
      requestId++
    },
    { flush: 'sync' }
  )
  const visibleUpdateGroups = computed(() =>
    scopeLibraryUpdateGroups(editor, updateGroups.value, showAllPages.value)
  )

  async function refresh() {
    const request = ++requestId
    loading.value = true
    let read = false
    try {
      await service.refresh(editor)
      const groups = await service.getUpdateGroups(editor)
      if (request === requestId) updateGroups.value = groups
      read = true
    } catch (cause) {
      if (request === requestId) {
        toast.error(notificationMessages.get().operationFailed({ error: errorMessage(cause) }))
      }
    } finally {
      if (request === requestId) {
        loading.value = false
        // A first read that failed has nothing current to show, so the dialog does not open.
        if (read || ready.value) ready.value = true
        else open.value = false
      }
    }
  }

  async function runOperation(operation: () => Promise<void>): Promise<void> {
    try {
      await operation()
    } catch (cause) {
      toast.error(notificationMessages.get().operationFailed({ error: errorMessage(cause) }))
    }
  }

  async function setSource(source: 'local' | 'storage') {
    await runOperation(async () => {
      if (source === 'local') service.useLocalCatalog()
      else {
        const providerId = activeStorageProviderID.value
        if (!storagePreferencesComplete(providerId)) throw new Error('Storage is not configured')
        await service.useStorageCatalog()
      }
      await refresh()
    })
  }

  async function toggleLibrary(libraryId: string) {
    loading.value = true
    try {
      await runOperation(async () => {
        if (editor.graph.enabledLibraries.get(libraryId)?.enabled)
          await service.disable(editor, libraryId)
        else await service.enable(editor, libraryId)
        await refresh()
      })
    } finally {
      loading.value = false
    }
  }

  function preferLibrary(libraryId: string) {
    const priority = maxOf([
      0,
      ...service.summaries.value.map((item) => readLibraryPriority(item.libraryId))
    ])
    service.setPriority(libraryId, priority + 1)
  }

  async function updateAsset(group: LibraryAssetUpdateGroup) {
    applying.value = `${group.libraryId}:${group.assetKey}`
    try {
      await runOperation(async () => {
        await service.applyUpdateGroups(editor, [group], `Update ${group.name}`)
        await refresh()
      })
    } finally {
      applying.value = null
    }
  }

  async function updateAll() {
    applying.value = 'all'
    try {
      await runOperation(async () => {
        await service.applyUpdateGroups(
          editor,
          visibleUpdateGroups.value,
          'Update all library assets'
        )
        await refresh()
      })
    } finally {
      applying.value = null
    }
  }

  watch(
    () => [open.value, editor.state.currentPageId] as const,
    ([isOpen]) => {
      if (isOpen) void refresh()
    },
    { immediate: true }
  )

  // A pull landing or failing changes what the updates tab lists while the manager is
  // open; `refresh()`'s request guard keeps a stale read from covering a newer one.
  watchDebounced(
    librarySyncResolution,
    () => {
      if (open.value) void refresh()
    },
    { debounce: RESOLUTION_REFRESH_DEBOUNCE_MS }
  )

  // A collaborator's change to the document's libraries shows while the manager is open.
  onScopeDispose(
    editor.onEditorEvent('document:libraries-changed', () => {
      if (open.value) void refresh()
    })
  )

  /**
   * The manager's browse rows: each summary with the document's binding resolved — enabled
   * state, the revision the row tracks (the binding's pin when enabled, else the summary's
   * latest), and the sync engine's state for that revision, `null` once mirrored.
   */
  const rows = computed(() =>
    service.summaries.value.map((library) => {
      const binding = editor.graph.enabledLibraries.get(library.libraryId)
      const enabled = binding?.enabled ?? false
      const revisionId = enabled && binding ? binding.revisionId : library.latestRevisionId
      const resolution =
        librarySyncResolution.value.get(libraryResolutionKey(library.libraryId, revisionId)) ?? null
      return { library, enabled, revisionId, resolution }
    })
  )

  /** Retries every failed row: clears the marks and re-arms the parked engine. */
  function retryLibrarySync(): void {
    void resumeLibrarySync()
  }

  return {
    section,
    loading,
    ready,
    showAllPages,
    applying,
    visibleUpdateGroups,
    refresh,
    setSource,
    toggleLibrary,
    preferLibrary,
    updateAsset,
    updateAll,
    rows,
    retryLibrarySync
  }
}
