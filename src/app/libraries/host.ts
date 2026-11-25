import { watchDebounced } from '@vueuse/core'
import { effectScope, watch } from 'vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { readLibraryCatalogSource } from '@/app/libraries/preferences'
import { LibraryService } from '@/app/libraries/service'
import { librarySyncRemote, librarySyncResolution } from '@/app/libraries/sync/status'

/** Resolution rows flip in bursts during a pull; one service refresh per settle. */
const RESOLUTION_REFRESH_DEBOUNCE_MS = 300

let service: LibraryService | undefined
let serviceScope: ReturnType<typeof effectScope> | null = null

export function useLibraryService(): LibraryService {
  if (!service) {
    const instance = new LibraryService()
    service = instance
    // Follow the sync engine's remote: every rebuild produces a fresh mirror with a catalog
    // already assembled. The engine cannot import the service — the service already consumes
    // its status — so the wiring lives here. The watches join a detached scope bound to the
    // singleton's own lifetime: in the caller's scope they would die with that component's
    // unmount while the cached service lives on, and the remote never reaches attachCatalog.
    serviceScope = effectScope(true)
    serviceScope.run(() => {
      watch(
        librarySyncRemote,
        (remote) => {
          const catalog = remote?.catalog ?? MirroredLibraryCatalog.placeholder()
          if (readLibraryCatalogSource() === 'storage') catalog.useStorage()
          instance.attachCatalog(catalog)
        },
        { immediate: true }
      )
      // A pull landing or failing changes what enabledAssets and updates can show.
      watchDebounced(
        librarySyncResolution,
        () => {
          const store = getActiveEditorStoreOrNull()
          if (store) void instance.refresh(store)
        },
        { debounce: RESOLUTION_REFRESH_DEBOUNCE_MS }
      )
    })
  }
  return service
}

/** Test seam: drops the singleton and its engine watches between runs. */
export function resetLibraryServiceForTests(): void {
  serviceScope?.stop()
  serviceScope = null
  service = undefined
}
