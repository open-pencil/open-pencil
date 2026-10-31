import { invoke } from '@tauri-apps/api/core'
import { watch, type Ref } from 'vue'

import type { SnappingPreferences } from '@open-pencil/core'

import { isTauri } from '@/app/tauri/env'

export const DESIGN_ISSUES_MENU_ID = 'view-design-issues'
export const COMMENTS_MENU_ID = 'view-comments'
export const RULERS_MENU_ID = 'view-rulers'
export const PIXEL_GRID_MENU_ID = 'view-pixel-grid'

const SNAPPING_MENU_IDS = {
  geometry: 'snap-geometry',
  objects: 'snap-objects',
  pixelGrid: 'snap-pixel-grid'
} satisfies Record<keyof SnappingPreferences, string>

export async function syncNativeSnappingMenu(preferences: SnappingPreferences): Promise<void> {
  if (!isTauri()) return
  await Promise.all(
    Object.entries(SNAPPING_MENU_IDS).map(([preference, id]) =>
      invoke('set_native_menu_checked', {
        id,
        checked: preferences[preference as keyof SnappingPreferences]
      })
    )
  )
}

export async function syncNativeDesignIssuesMenu(showOnCanvas: boolean): Promise<void> {
  if (!isTauri()) return
  await invoke('set_native_menu_checked', { id: DESIGN_ISSUES_MENU_ID, checked: showOnCanvas })
}

/**
 * View → Rulers and View → Pixel Grid, which their keys and the zoom menu also toggle; on Linux
 * those keys never reach the native menu (`desktop/src/menu/mod.rs`), so it learns of them here.
 */
export async function syncNativeCanvasViewMenu(view: {
  rulers: boolean
  pixelGrid: boolean
}): Promise<void> {
  if (!isTauri()) return
  await Promise.all([
    invoke('set_native_menu_checked', { id: RULERS_MENU_ID, checked: view.rulers }),
    invoke('set_native_menu_checked', { id: PIXEL_GRID_MENU_ID, checked: view.pixelGrid })
  ])
}

/** What {@link followNativeCanvasViewMenu} reads of a document. */
interface CanvasViewSource {
  state: { showRulers: boolean; showPixelGrid?: boolean }
}

/**
 * Keeps View → Rulers and View → Pixel Grid checked as the active document shows them, whatever
 * toggled them and when another document becomes active.
 */
export function followNativeCanvasViewMenu(store: Ref<CanvasViewSource | undefined>): () => void {
  return watch(
    () => {
      const state = store.value?.state
      return state ? { rulers: state.showRulers, pixelGrid: state.showPixelGrid !== false } : null
    },
    (view) => {
      if (!view) return
      void syncNativeCanvasViewMenu(view).catch((error: unknown) => {
        console.error('[Menu] Failed to synchronize the native rulers and pixel grid:', error)
      })
    },
    { immediate: true, deep: true }
  )
}

/** View → Comments, which Shift+C and the comment menus also toggle. */
export async function syncNativeCommentsMenu(shown: boolean): Promise<void> {
  if (!isTauri()) return
  await invoke('set_native_menu_checked', { id: COMMENTS_MENU_ID, checked: shown })
}
