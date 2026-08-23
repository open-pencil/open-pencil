import type { SnappingPreferences } from '@open-pencil/core/editor'

import { getTabsSnapshot } from '@/app/tabs'

import { syncNativeSnappingMenu } from './native-menu'
import { appPreferences, updateSnappingPreferences } from './store'

export function setSnappingPreference(
  preference: keyof SnappingPreferences,
  enabled: boolean
): void {
  updateSnappingPreferences({ [preference]: enabled })
  const snapping = appPreferences.value.editing.snapping
  for (const tab of getTabsSnapshot()) {
    tab.store.state.snappingPreferences = { ...snapping }
  }
  void syncNativeSnappingMenu(snapping).catch((error: unknown) => {
    console.error('[Settings] Failed to synchronize native snapping preferences:', error)
  })
}
