import type { SnappingPreferences } from '@open-pencil/core/editor'

import { isTauri } from '@/app/tauri/env'

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
