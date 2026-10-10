import type { SnappingPreferences } from '@open-pencil/core/editor'

import { isTauri } from '@/app/tauri/env'

export const DESIGN_ISSUES_MENU_ID = 'view-design-issues'
export const COMMENTS_MENU_ID = 'view-comments'

const SNAPPING_MENU_IDS = {
  geometry: 'snap-geometry',
  objects: 'snap-objects',
  pixelGrid: 'snap-pixel-grid'
} satisfies Record<keyof SnappingPreferences, string>

export async function syncNativeSnappingMenu(preferences: SnappingPreferences): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
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
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_native_menu_checked', { id: DESIGN_ISSUES_MENU_ID, checked: showOnCanvas })
}

/** View → Comments, which Shift+C and the comment menus also toggle. */
export async function syncNativeCommentsMenu(shown: boolean): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_native_menu_checked', { id: COMMENTS_MENU_ID, checked: shown })
}
