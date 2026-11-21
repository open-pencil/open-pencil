// Keeps a design that lives only on this device, or in the storage bucket, in the address bar,
// `/design/<id>`, so a reload opens it again. The ID is the design's recovery copy, which keeps the
// same ID across reloads, or its stored document's (`stored-design.ts`); Cloud documents and rooms
// keep the addresses `address.ts` gives them. On start, the designs the
// browser tab had open come back with it (`kept/`).
import { shallowRef, watch } from 'vue'
import {
  START_LOCATION,
  type RouteLocationNormalized,
  type RouteLocationNormalizedLoaded,
  type Router
} from 'vue-router'

import { errorMessage } from '@open-pencil/std/errors'

import { openingCloudLink } from '@/app/cloud/integration'
import { roomForStore } from '@/app/collab/rooms'
import { getRecoveryStore } from '@/app/document/recovery'
import type { EditorStore } from '@/app/editor/session'
import { onBeforeReload } from '@/app/shell/reload'
import { keepOpenTabs, restoreKeptTabs } from '@/app/tabs/kept'
import { keepDesignNames } from '@/app/tabs/kept/names'
import { restoreRecoverySnapshot } from '@/app/tabs/open/recovery'
import type { Tab } from '@/app/tabs/state'
import { releaseSplashForDesign } from '@/splash/opening-design'

import { activeTab } from './index'
import { hasStoredDesign, reopenStoredDesign, storedDesignIdOf } from './stored-design'

export const DESIGN_ROUTE_PREFIX = '/design/'

export function designRoutePath(designId: string): string {
  return `${DESIGN_ROUTE_PREFIX}${designId}`
}

/** Whether the document is kept nowhere but this device: no stored copy, file, room, or Cloud link. */
function livesOnlyHere(store: EditorStore): boolean {
  const source = store.getSourceIdentity()
  return (
    store.getStorageBinding() === null &&
    source.path === null &&
    source.handle === null &&
    !roomForStore(store)
  )
}

/** The recovery copy's ID of a tab's design kept only here, otherwise null. */
export function recoveryDesignIdOf(tab: Tab | undefined): string | null {
  if (tab?.kind !== 'document') return null
  return livesOnlyHere(tab.store) ? tab.store.getRecoveryId() : null
}

/**
 * A tab's `/design/` ID: its recovery copy's for a design kept only here, its stored document's for
 * one kept in the storage bucket, otherwise null.
 */
export function designIdOf(tab: Tab | undefined): string | null {
  if (tab?.kind !== 'document') return null
  return recoveryDesignIdOf(tab) ?? storedDesignIdOf(tab.store)
}

/** Whether this device can open the design `designId` names again. */
async function designExists(designId: string): Promise<boolean> {
  return (await getRecoveryStore().read(designId)) !== null || (await hasStoredDesign(designId))
}

/** Opens the design `designId` names in a tab: its recovery copy, or the stored document. */
async function reopenDesign(designId: string): Promise<void> {
  if (await getRecoveryStore().read(designId)) {
    await restoreRecoverySnapshot(designId)
    return
  }

  await reopenStoredDesign(designId)
}

/** The base address, keeping the query and hash `to` came with, such as `?test`. */
export function baseAddressFrom(to: Pick<RouteLocationNormalized, 'query' | 'hash'>) {
  return { path: '/', query: to.query, hash: to.hash }
}

/**
 * The route guard of `/design/:designId`: an address the page loads with whose design has no copy
 * left on this device goes to `/` before anything shows. The app's own updates of the address pass,
 * since a design gets its copy only once it is edited.
 */
export async function designRouteGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
): Promise<true | ReturnType<typeof baseAddressFrom>> {
  if (from !== START_LOCATION) return true
  const designId = to.params.designId
  if (typeof designId !== 'string') return baseAddressFrom(to)
  return (await designExists(designId)) ? true : baseAddressFrom(to)
}

/**
 * Writes the active design's copy now rather than a few seconds after its last edit, so an
 * announced reload right after an edit still finds the design its address names.
 */
function persistActiveDesign(): Promise<void> {
  // A stored design saves and uploads on its own; only a recovery copy waits a few seconds.
  const store = recoveryDesignIdOf(activeTab.value) ? activeTab.value?.store : undefined
  if (!store) return Promise.resolve()
  return store.persistRecoveryNow().catch((error: unknown) => {
    console.warn(
      `[Design address] Could not keep the design before leaving: ${errorMessage(error)}`
    )
  })
}

/**
 * Puts the active design's address in the address bar. On start it reopens the designs the browser
 * tab had open and the one the address names, in front; until they have opened the address stays,
 * so a reload meanwhile keeps it, and the boot splash stays over the app. A reload the app
 * announces, such as the development server's, writes the design's copy first.
 */
export function syncDesignAddress(
  router: Router,
  route: RouteLocationNormalizedLoaded
): () => void {
  const startId = typeof route.params.designId === 'string' ? route.params.designId : null
  const restored = shallowRef(false)
  void restoreKeptTabs(startId, designIdOf, reopenDesign)
    .catch((error: unknown) =>
      console.error(`[Design address] Could not reopen the open designs: ${errorMessage(error)}`)
    )
    .finally(() => {
      restored.value = true
      releaseSplashForDesign()
    })

  function update(): void {
    if (!restored.value || openingCloudLink.value) return
    const designId = designIdOf(activeTab.value)
    if (designId) {
      const path = designRoutePath(designId)
      if (route.path !== path) void router.replace({ path, query: route.query, hash: route.hash })
      return
    }

    if (!route.path.startsWith(DESIGN_ROUTE_PREFIX)) return
    // Home, a room, or a stored file: the address `address.ts` keeps, or `/`.
    void router.replace({ path: '/', query: route.query, hash: route.hash })
  }

  const stopWatch = watch(
    // A tab that restores a copy takes the copy's ID while it loads, which is not reactive, so the
    // address is worked out again once loading ends (`preparation` clears).
    () =>
      [
        restored.value,
        designIdOf(activeTab.value),
        activeTab.value?.store.state.preparation ?? null,
        openingCloudLink.value,
        route.path
      ] as const,
    update,
    { immediate: true }
  )
  const stopKeeping = keepOpenTabs(designIdOf, () => restored.value)
  const stopNaming = keepDesignNames(recoveryDesignIdOf)
  const stopReload = onBeforeReload(persistActiveDesign)
  return () => {
    stopWatch()
    stopKeeping()
    stopNaming()
    stopReload()
  }
}
