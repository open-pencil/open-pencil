// Keeps a design that lives only on this device in the address bar, `/design/<id>`, so a reload
// opens it again. The ID is the design's recovery copy, which keeps the same ID across reloads;
// Cloud documents and rooms keep the addresses `address.ts` gives them.
import { watch } from 'vue'
import {
  START_LOCATION,
  type RouteLocationNormalized,
  type RouteLocationNormalizedLoaded,
  type Router
} from 'vue-router'

import { errorMessage } from '@open-pencil/std/errors'

import { openingCloudLink } from '@/app/cloud/integration'
import { activeRoom } from '@/app/collab/rooms'
import { getRecoveryStore } from '@/app/document/recovery'
import type { EditorStore } from '@/app/editor/session'
import { onBeforeReload } from '@/app/shell/reload'
import { restoreRecoverySnapshot } from '@/app/tabs/open/recovery'
import { releaseSplashForDesign } from '@/splash/opening-design'

import { activeTab } from './index'

export const DESIGN_ROUTE_PREFIX = '/design/'

export function designRoutePath(designId: string): string {
  return `${DESIGN_ROUTE_PREFIX}${designId}`
}

/** Whether the document is kept nowhere but this device: no stored copy, file, or Cloud link. */
function livesOnlyHere(store: EditorStore): boolean {
  const source = store.getSourceIdentity()
  return store.getStorageBinding() === null && source.path === null && source.handle === null
}

/** The `/design/` address of the active tab, or null when it has none of its own. */
function activeDesignId(): string | null {
  const tab = activeTab.value
  if (tab?.kind !== 'document' || activeRoom.value) return null
  return livesOnlyHere(tab.store) ? tab.store.getRecoveryId() : null
}

/**
 * The route guard of `/design/:designId`: an address the page loads with whose design has no copy
 * left on this device goes to `/` before anything shows. The app's own updates of the address pass,
 * since a design gets its copy only once it is edited.
 */
export async function designRouteGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
): Promise<true | string> {
  if (from !== START_LOCATION) return true
  const designId = to.params.designId
  if (typeof designId !== 'string') return '/'
  if (await getRecoveryStore().read(designId)) return true
  releaseSplashForDesign()
  return '/'
}

/** Opens the design an address names; one whose copy is gone leaves the person on Home. */
async function openDesign(designId: string): Promise<boolean> {
  if (!(await getRecoveryStore().read(designId))) {
    console.debug(`[Design address] No copy of ${designId} is left on this device`)
    return false
  }
  await restoreRecoverySnapshot(designId)
  return true
}

/**
 * Writes the active design's copy now rather than a few seconds after its last edit, so an
 * announced reload right after an edit still finds the design its address names.
 */
function persistActiveDesign(): Promise<void> {
  // `activeDesignId` is set only for a document tab, so its store is the design's.
  const store = activeDesignId() ? activeTab.value?.store : undefined
  if (!store) return Promise.resolve()
  return store.persistRecoveryNow().catch((error: unknown) => {
    console.warn(
      `[Design address] Could not keep the design before leaving: ${errorMessage(error)}`
    )
  })
}

/**
 * Puts the active design's address in the address bar, and on start opens the design the address
 * names. Until that design has opened the address stays, so a reload meanwhile keeps it, and the
 * boot splash stays over the app. A reload the app announces, such as the development server's,
 * writes the design's copy first.
 */
export function syncDesignAddress(
  router: Router,
  route: RouteLocationNormalizedLoaded
): () => void {
  const startId = typeof route.params.designId === 'string' ? route.params.designId : null
  let opening = startId !== null
  if (startId) {
    void openDesign(startId)
      .catch((error: unknown) =>
        console.error(`[Design address] Could not open ${startId}: ${errorMessage(error)}`)
      )
      .finally(() => {
        opening = false
        releaseSplashForDesign()
        update()
      })
  }

  function update(): void {
    if (opening || openingCloudLink.value) return
    const designId = activeDesignId()
    const onDesign = route.path.startsWith(DESIGN_ROUTE_PREFIX)
    if (designId) {
      const path = designRoutePath(designId)
      if (route.path !== path) void router.replace({ path, query: route.query, hash: route.hash })
    } else if (onDesign) {
      // Home, a room, or a stored file: the address `address.ts` keeps, or `/`.
      void router.replace({ path: '/', query: route.query, hash: route.hash })
    }
  }

  const stopWatch = watch(
    // A tab that restores a copy takes the copy's ID while it loads, which is not reactive, so the
    // address is worked out again once loading ends (`preparation` clears).
    () =>
      [
        activeDesignId(),
        activeTab.value?.store.state.preparation ?? null,
        openingCloudLink.value,
        route.path
      ] as const,
    update,
    { immediate: true }
  )
  const stopReload = onBeforeReload(persistActiveDesign)
  return () => {
    stopWatch()
    stopReload()
  }
}
